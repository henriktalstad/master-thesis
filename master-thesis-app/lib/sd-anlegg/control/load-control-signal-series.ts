import "server-only";

import { loadControlLoopStepsForLookback } from "@/lib/sd-anlegg/control/live/load-control-loop-steps";
import { loadPipelineReplayStepsByRange } from "@/lib/sd-anlegg/control/persist-mpc-pipeline-replay-steps";
import {
  resolveControlLoopDisplaySteps,
  trimLeadingGapOnly,
  type ControlLoopDisplaySource,
} from "@/lib/sd-anlegg/control/resolve-control-loop-display-steps";
import {
  buildControlSignalSeriesMetadata,
  shouldUseHourlyBucketCache,
  type ControlSignalSeriesMetadata,
} from "@/lib/sd-anlegg/control/control-signal-series-helpers";
import { loadControlSignalHourSteps } from "@/lib/sd-anlegg/control/persist-control-signal-hours";
import { mergeFineSdProfilesWithReplaySteps, patchSdObservedOntoReplaySteps } from "@/lib/sd-anlegg/control/merge-fine-sd-with-replay-steps";
import { loadSdFineProfilesForControl } from "@/lib/sd-anlegg/control/load-cached-sd-fine-profiles";
import {
  loadSdObservedBucketProfiles,
} from "@/lib/sd-anlegg/control/persist-sd-observed-buckets";
import { schedulePersistSdBucketsJob } from "@/lib/inngest/schedule";
import type { ControlSdHourlyProfile } from "@/lib/sd-anlegg/control/control-sd-calibration";
import {
  AUTO_HOUR_AGGREGATE_LOOKBACK_HOURS,
  effectiveLookbackHoursForGrain,
  resolveControlLoopStepLimit,
  resolveControlLookbackDays,
  resolveFineGrainLoadCandidates,
  resolveFineGrainSeriesWindow,
  styringStepMinutesToGrain,
  STYRING_GRAIN_MAX_LOOKBACK_HOURS,
  type ControlDisplayStepMinutes,
  type ControlPeriodMode,
  type StyringSignalGrain,
} from "@/lib/sd-anlegg/control/resolve-control-lookback";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

export type ControlSignalSeriesResolution = ControlDisplayStepMinutes;

export type ControlSignalSeriesLoadResult = {
  steps: MpcReplayStep[];
  source: ControlLoopDisplaySource;
  resolution: ControlSignalSeriesResolution;
  stepMinutes: ControlDisplayStepMinutes;
  coverageHint: string | null;
  expectedStepCount: number;
  coverageRatio: number;
  resolutionNote: string | null;
};

async function loadFifteenMinuteSteps(input: {
  buildingId: string;
  pipelineRunId: string | null;
  since: Date;
  until?: Date;
  stepLimit: number;
  periodMode?: ControlPeriodMode;
}): Promise<ReturnType<typeof resolveControlLoopDisplaySteps>> {
  if (input.periodMode === "eval" && input.pipelineRunId) {
    const pipelineSteps = await loadPipelineReplayStepsByRange({
      pipelineRunId: input.pipelineRunId,
      since: input.since,
      until: input.until,
    });
    return resolveControlLoopDisplaySteps([], pipelineSteps, 15, {
      periodMode: "eval",
    });
  }

  const [liveSteps, pipelineSteps] = await Promise.all([
    loadControlLoopStepsForLookback(input.buildingId, input.stepLimit, input.since),
    input.pipelineRunId
      ? loadPipelineReplayStepsByRange({
          pipelineRunId: input.pipelineRunId,
          since: input.since,
          until: input.until,
        })
      : Promise.resolve([] as MpcReplayStep[]),
  ]);
  return resolveControlLoopDisplaySteps(liveSteps, pipelineSteps, 15, {
    periodMode: input.periodMode,
  });
}

async function aggregateStepsToHourReplay(
  steps: readonly MpcReplayStep[],
): Promise<MpcReplayStep[]> {
  const {
    aggregateReplayStepsToControlHours,
    expandControlSignalHourToReplayStep,
  } = await import("@/lib/sd-anlegg/control/compact-control-signal-hour");
  return aggregateReplayStepsToControlHours(steps).map((hour) =>
    expandControlSignalHourToReplayStep(hour.hourAt, hour.payload),
  );
}

function buildLookbackCapHint(
  grain: StyringSignalGrain,
  requestedHours: number,
  effectiveHours: number,
): string | null {
  if (effectiveHours >= requestedHours) return null;
  if (grain === "1") {
    return "1-min SD viser maks 24 t — velg kortere periode for full detalj.";
  }
  if (grain === "5") {
    return "5-min SD viser maks 7 d — eldre data vises i 15-min oppløsning.";
  }
  return null;
}

function clipStepsToRange(
  steps: readonly MpcReplayStep[],
  since: Date,
  until: Date,
): MpcReplayStep[] {
  const startMs = since.getTime();
  const endMs = until.getTime();
  return steps.filter((step) => {
    const t = new Date(step.t).getTime();
    return t >= startMs && t <= endMs;
  });
}

function finalizeSeriesResult(input: {
  steps: MpcReplayStep[];
  source: ControlLoopDisplaySource;
  resolution: ControlSignalSeriesResolution;
  stepMinutes: ControlDisplayStepMinutes;
  coverageHint: string | null;
  lookbackHours: number;
  effectiveHours: number;
  grain: StyringSignalGrain;
  autoHour?: boolean;
  rangeSince?: Date;
  rangeUntil?: Date;
  skipLeadingTrim?: boolean;
  expectedStepCount?: number;
}): ControlSignalSeriesLoadResult {
  const clipped =
    input.rangeSince && input.rangeUntil
      ? clipStepsToRange(input.steps, input.rangeSince, input.rangeUntil)
      : input.steps;
  const trimmed = input.skipLeadingTrim
    ? clipped
    : trimLeadingGapOnly(clipped, input.stepMinutes);
  const metadata = buildControlSignalSeriesMetadata({
    steps: trimmed,
    stepMinutes: input.stepMinutes,
    lookbackHours: input.lookbackHours,
    effectiveHours: input.effectiveHours,
    grain: input.grain,
    autoHour: input.autoHour,
  });
  if (input.expectedStepCount != null && input.expectedStepCount > 0) {
    metadata.expectedStepCount = input.expectedStepCount;
    metadata.coverageRatio = Math.min(
      1,
      trimmed.length / input.expectedStepCount,
    );
  }

  return {
    steps: trimmed,
    source: input.source,
    resolution: input.resolution,
    stepMinutes: input.stepMinutes,
    coverageHint: input.coverageHint,
    ...metadata,
  };
}

async function loadSdObservedProfiles(input: {
  buildingId: string;
  buildingSlug: string;
  sourceId: string;
  pipelineRunId: string | null;
  since: Date;
  effectiveHours: number;
  stepMinutes: 1 | 5;
  maxBucketAgeMs?: number;
  minDbBuckets?: number;
}): Promise<ControlSdHourlyProfile[]> {
  const fromDb = await loadSdObservedBucketProfiles({
    buildingId: input.buildingId,
    since: input.since,
    bucketMinutes: input.stepMinutes,
    maxBuckets: Math.ceil((input.effectiveHours * 60) / input.stepMinutes),
    maxAgeMs: input.maxBucketAgeMs,
  });
  if (
    fromDb?.length &&
    (input.minDbBuckets == null || fromDb.length >= input.minDbBuckets)
  ) {
    return fromDb;
  }

  const sd = await loadSdFineProfilesForControl({
    buildingSlug: input.buildingSlug,
    buildingId: input.buildingId,
    sourceId: input.sourceId,
    hours: input.effectiveHours,
    stepMinutes: input.stepMinutes,
  });

  if (sd.profiles.length > 0) {
    schedulePersistSdBucketsJob({
      buildingId: input.buildingId,
      buildingSlug: input.buildingSlug,
      profiles: sd.profiles,
      bucketMinutes: input.stepMinutes,
      pipelineRunId: input.pipelineRunId,
    }).catch(() => undefined);
  }

  return sd.profiles;
}

const SD_TAIL_LOOKBACK_HOURS = STYRING_GRAIN_MAX_LOOKBACK_HOURS["5"];

async function enrichGrain15StepsWithSdObserved(input: {
  steps: MpcReplayStep[];
  stepMinutes: 15 | 60;
  buildingId: string;
  buildingSlug: string;
  sourceId: string;
  pipelineRunId: string | null;
  since: Date;
  lookbackHours: number;
}): Promise<MpcReplayStep[]> {
  const sdHours = Math.min(input.lookbackHours, SD_TAIL_LOOKBACK_HOURS);
  const sdSince = new Date(Date.now() - sdHours * 3_600_000);
  const effectiveSince =
    sdSince.getTime() > input.since.getTime() ? sdSince : input.since;
  const minDbBuckets = Math.ceil(((sdHours * 60) / 5) * 0.25);

  const sdProfiles = await loadSdObservedProfiles({
    buildingId: input.buildingId,
    buildingSlug: input.buildingSlug,
    sourceId: input.sourceId,
    pipelineRunId: input.pipelineRunId,
    since: effectiveSince,
    effectiveHours: sdHours,
    stepMinutes: 5,
    maxBucketAgeMs: 24 * 3_600_000,
    minDbBuckets,
  });

  if (sdProfiles.length === 0) return input.steps;

  return patchSdObservedOntoReplaySteps({
    replaySteps: input.steps,
    sdProfiles,
    bucketMinutes: input.stepMinutes,
    extendTail: true,
  });
}

async function buildHourlyStepsFromResolved(input: {
  resolved: ReturnType<typeof resolveControlLoopDisplaySteps>;
  grain: StyringSignalGrain;
  sourceId?: string | null;
  buildingId: string;
  buildingSlug: string;
  pipelineRunId: string | null;
  since: Date;
  lookbackHours: number;
}): Promise<MpcReplayStep[]> {
  const aggregatedSteps = await aggregateStepsToHourReplay(input.resolved.steps);
  if (input.grain === "15" && input.sourceId) {
    return enrichGrain15StepsWithSdObserved({
      steps: aggregatedSteps,
      stepMinutes: 60,
      buildingId: input.buildingId,
      buildingSlug: input.buildingSlug,
      sourceId: input.sourceId,
      pipelineRunId: input.pipelineRunId,
      since: input.since,
      lookbackHours: input.lookbackHours,
    });
  }
  return aggregatedSteps;
}

async function tryLoadFineGrainControlSeries(input: {
  stepMinutes: 1 | 5;
  buildingId: string;
  buildingSlug: string;
  pipelineRunId: string | null;
  sourceId: string;
  lookbackHours: number;
  periodMode: ControlPeriodMode;
  rangeSince?: Date;
  rangeUntil: Date;
}): Promise<ControlSignalSeriesLoadResult | null> {
  const grain = styringStepMinutesToGrain(input.stepMinutes);
  const effectiveHours = effectiveLookbackHoursForGrain(
    input.lookbackHours,
    grain,
  );
  const capHint = buildLookbackCapHint(
    grain,
    input.lookbackHours,
    effectiveHours,
  );
  const fineWindow = resolveFineGrainSeriesWindow({
    rangeSince: input.rangeSince,
    rangeUntil: input.rangeUntil,
    effectiveHours,
  });

  const [resolved, sdProfiles] = await Promise.all([
    loadFifteenMinuteSteps({
      buildingId: input.buildingId,
      pipelineRunId: input.pipelineRunId,
      since: fineWindow.since,
      until: fineWindow.until,
      stepLimit: resolveControlLoopStepLimit(effectiveHours),
    }),
    loadSdObservedProfiles({
      buildingId: input.buildingId,
      buildingSlug: input.buildingSlug,
      sourceId: input.sourceId,
      pipelineRunId: input.pipelineRunId,
      since: fineWindow.since,
      effectiveHours,
      stepMinutes: input.stepMinutes,
      maxBucketAgeMs: 24 * 3_600_000,
    }),
  ]);

  if (sdProfiles.length === 0) return null;

  const steps = mergeFineSdProfilesWithReplaySteps({
    replaySteps: resolved.steps,
    sdProfiles,
    stepMinutes: input.stepMinutes,
  });
  if (steps.length === 0) return null;

  return finalizeSeriesResult({
    steps,
    source: resolved.source,
    resolution: input.stepMinutes,
    stepMinutes: input.stepMinutes,
    coverageHint:
      capHint ??
      resolved.coverageHint ??
      "Simulert forslag vises per 15 min.",
    lookbackHours: input.lookbackHours,
    effectiveHours,
    grain,
    rangeSince: fineWindow.since,
    rangeUntil: fineWindow.until,
  });
}

/** Laster styringssignaler for valgt periode og oppløsning. */
export async function loadControlSignalSeriesForWorkspace(input: {
  buildingId: string;
  buildingSlug: string;
  pipelineRunId: string | null;
  lookbackHours: number;
  grain: StyringSignalGrain;
  sourceId?: string | null;
  periodMode?: ControlPeriodMode;
  rangeSince?: Date;
  rangeUntil?: Date;
  /** Eval: forventede 15-min intervaller i vinduet. */
  expectedStepCount?: number;
}): Promise<ControlSignalSeriesLoadResult> {
  const periodMode = input.periodMode ?? "live";
  const lookbackDays = resolveControlLookbackDays(input.lookbackHours);
  const rangeUntil = input.rangeUntil ?? new Date();
  const effectiveHours =
    periodMode === "eval"
      ? input.lookbackHours
      : effectiveLookbackHoursForGrain(input.lookbackHours, input.grain);
  const capHint = buildLookbackCapHint(
    input.grain,
    input.lookbackHours,
    effectiveHours,
  );
  const since =
    input.rangeSince ??
    new Date(rangeUntil.getTime() - effectiveHours * 3_600_000);
  const stepLimit =
    periodMode === "eval" && input.expectedStepCount
      ? input.expectedStepCount
      : resolveControlLoopStepLimit(effectiveHours);
  const rangeClip = {
    rangeSince: input.rangeSince ?? since,
    rangeUntil,
  };

  const fineCandidates = resolveFineGrainLoadCandidates({
    periodMode,
    lookbackDays,
  });
  if (input.sourceId && fineCandidates.length > 0) {
    for (const stepMinutes of fineCandidates) {
      const loaded = await tryLoadFineGrainControlSeries({
        stepMinutes,
        buildingId: input.buildingId,
        buildingSlug: input.buildingSlug,
        pipelineRunId: input.pipelineRunId,
        sourceId: input.sourceId,
        lookbackHours: input.lookbackHours,
        periodMode,
        rangeSince: input.rangeSince,
        rangeUntil,
      });
      if (loaded) return loaded;
    }
  }

  const resolved = await loadFifteenMinuteSteps({
    buildingId: input.buildingId,
    pipelineRunId: input.pipelineRunId,
    since,
    until: input.rangeUntil,
    stepLimit,
    periodMode,
  });

  const autoHour =
    periodMode === "live" &&
    input.lookbackHours >= AUTO_HOUR_AGGREGATE_LOOKBACK_HOURS;

  if (autoHour && resolved.steps.length > 0) {
    const maxBuckets = Math.ceil(input.lookbackHours);
    const lookbackSince = since;
    const { loadControlSignalBucketSteps } = await import(
      "@/lib/sd-anlegg/control/persist-control-signal-buckets"
    );
    const bucketSteps = await loadControlSignalBucketSteps({
      buildingId: input.buildingId,
      since: lookbackSince,
      bucketMinutes: 60,
      maxBuckets,
    });

    let hourlySteps: MpcReplayStep[];
    let coverageHint =
      resolved.coverageHint ??
      "Timevis gjennomsnitt for rask visning av lang periode.";
    let usedSparseCache = false;

    if (
      bucketSteps.length > 0 &&
      shouldUseHourlyBucketCache(bucketSteps.length, input.lookbackHours)
    ) {
      hourlySteps =
        input.grain === "15" && input.sourceId
          ? await enrichGrain15StepsWithSdObserved({
              steps: bucketSteps,
              stepMinutes: 60,
              buildingId: input.buildingId,
              buildingSlug: input.buildingSlug,
              sourceId: input.sourceId,
              pipelineRunId: input.pipelineRunId,
              since,
              lookbackHours: input.lookbackHours,
            })
          : bucketSteps;
    } else {
      const hourSteps = await loadControlSignalHourSteps({
        buildingId: input.buildingId,
        since: lookbackSince,
        maxHours: maxBuckets,
      });
      if (
        hourSteps.length > 0 &&
        shouldUseHourlyBucketCache(hourSteps.length, input.lookbackHours)
      ) {
        hourlySteps =
          input.grain === "15" && input.sourceId
            ? await enrichGrain15StepsWithSdObserved({
                steps: hourSteps,
                stepMinutes: 60,
                buildingId: input.buildingId,
                buildingSlug: input.buildingSlug,
                sourceId: input.sourceId,
                pipelineRunId: input.pipelineRunId,
                since,
                lookbackHours: input.lookbackHours,
              })
            : hourSteps;
      } else {
        usedSparseCache = bucketSteps.length > 0 || hourSteps.length > 0;
        hourlySteps = await buildHourlyStepsFromResolved({
          resolved,
          grain: input.grain,
          sourceId: input.sourceId,
          buildingId: input.buildingId,
          buildingSlug: input.buildingSlug,
          pipelineRunId: input.pipelineRunId,
          since,
          lookbackHours: input.lookbackHours,
        });
        if (usedSparseCache) {
          coverageHint =
            "Time-cache hadde lav dekning — viser aggregert fra 15-min simulering.";
        }
      }
    }

    return finalizeSeriesResult({
      steps: hourlySteps,
      source: resolved.source,
      resolution: 60,
      stepMinutes: 60,
      coverageHint,
      lookbackHours: input.lookbackHours,
      effectiveHours,
      grain: input.grain,
      autoHour: true,
      ...rangeClip,
    });
  }

  const steps15 =
    periodMode === "eval" || !input.sourceId
      ? resolved.steps
      : await enrichGrain15StepsWithSdObserved({
          steps: resolved.steps,
          stepMinutes: 15,
          buildingId: input.buildingId,
          buildingSlug: input.buildingSlug,
          sourceId: input.sourceId,
          pipelineRunId: input.pipelineRunId,
          since,
          lookbackHours: input.lookbackHours,
        });

  return finalizeSeriesResult({
    steps: steps15,
    source: resolved.source,
    resolution: 15,
    stepMinutes: 15,
    coverageHint: resolved.coverageHint ?? capHint,
    lookbackHours: input.lookbackHours,
    effectiveHours,
    grain: input.grain,
    skipLeadingTrim: periodMode === "eval",
    expectedStepCount: input.expectedStepCount,
    ...rangeClip,
  });
}

export type { ControlSignalSeriesMetadata };
