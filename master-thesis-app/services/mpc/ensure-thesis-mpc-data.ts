import "server-only";

import { utcDayMidnight } from "@/lib/energy-prices/day-utils";
import {
  getMpcSdStaleSampleHours,
  getSdCoverageThreshold,
  getThesisEvalWindow,
  parseThesisEnvDate,
} from "@/lib/config/thesis-eval";
import { isMpcAutoEnsureEnabled } from "@/lib/config/mpc-automation";
import { isInngestEnabled } from "@/lib/inngest/client";
import { MPC_BACKGROUND_ENSURE_COOLDOWN_MS } from "@/lib/sd-anlegg/control/control-constants";
import { revalidateStyringWorkspace } from "@/lib/jobs/pipeline-jobs";
import {
  evalStartsBeforeInfluxLookback,
  resolveInfluxMaxLookbackHours,
} from "@/lib/infraspawn/influx-lookback";
import {
  analyzeMpcEvalCoverage,
  analyzeMpcEvalCoverageFull,
  type MpcEvalCoverageReport,
} from "./analyze-eval-coverage";
import { resolveEffectiveEvalWindowForMpc } from "./resolve-effective-eval-window";
import { persistMpcPipelineRun } from "@/lib/sd-anlegg/control/persist-mpc-pipeline-run";
import {
  markMpcSimulationFinished,
} from "@/lib/sd-anlegg/control/mpc-simulation-progress";
import {
  runMpcSimulationFromEvalDataset,
  type MpcSimulationRunResult,
} from "./run-mpc-pipeline-core";
import { enqueueAndScheduleMpcSimulationJob } from "./run-mpc-simulation-job";
import { loadEvalDatasetForMpc } from "./load-eval-dataset";
import { resolveMpcBuildingSource } from "./resolve-mpc-context";
import { runThesisMpcBackfillPipeline } from "./thesis-mpc-backfill-pipeline";
import type { MpcSimulationProgress } from "@/lib/sd-anlegg/control/mpc-simulation-progress";

export type EnsureThesisMpcDataOptions = {
  buildingSlug?: string;
  runSimulation?: boolean;
  /** Default true — UI/cron enqueuer jobb i stedet for synkron replay. */
  asyncSimulation?: boolean;
  forceDataRefresh?: boolean;
  skipFullSourceSync?: boolean;
  autoClipEvalStart?: boolean;
  maxSyncIterations?: number;
  allowDirectInflux?: boolean;
  directInfluxMaxPages?: number;
  /** Avbryt aktiv simulering og start ny (manuell «Oppdater replay»). */
  forceSimulationRestart?: boolean;
};

export type EnsureThesisMpcDataResult = {
  ok: boolean;
  actions: string[];
  coverageBefore: MpcEvalCoverageReport | null;
  coverageAfter: MpcEvalCoverageReport | null;
  effectiveEvalStart?: string;
  effectiveEvalEnd?: string;
  simulation?: MpcSimulationRunResult;
  simulationJobId?: string | null;
  simulationQueued?: boolean;
  mpcRunId?: string | null;
  message: string;
};

function parseEvalStart(): Date {
  const thesis = getThesisEvalWindow();
  const fromEnv =
    parseThesisEnvDate(process.env.INFRASPAWN_BACKFILL_START) ?? thesis.start;
  if (fromEnv) return utcDayMidnight(fromEnv);
  const fallback = new Date();
  fallback.setUTCDate(fallback.getUTCDate() - 90);
  return utcDayMidnight(fallback);
}

export async function ensureThesisMpcData(
  options: EnsureThesisMpcDataOptions = {},
): Promise<EnsureThesisMpcDataResult> {
  const actions: string[] = [];
  const thresholdPct = getSdCoverageThreshold();
  const allowDirectInflux = options.allowDirectInflux !== false;

  const ctx = await resolveMpcBuildingSource({
    buildingSlug: options.buildingSlug,
  });
  if (!ctx) {
    return {
      ok: false,
      actions,
      coverageBefore: null,
      coverageAfter: null,
      message: "Fant ikke bygg/kilde for MPC",
    };
  }

  const coverageBefore =
    (await analyzeMpcEvalCoverage({ buildingSlug: options.buildingSlug })) ??
    null;

  const needsData =
    options.forceDataRefresh ||
    coverageBefore?.needsBackfill ||
    (coverageBefore?.stepCount ?? 0) < 96;

  let coverageAfter = coverageBefore;

  if (!needsData) {
    const pct = Math.round((coverageBefore?.uMeasPct ?? 0) * 100);
    actions.push(`Dekning OK (${pct} % uMeas) — hopper over backfill`);
  } else {
    if (
      coverageBefore?.needsSampleRefresh &&
      !coverageBefore?.needsMpcBackfill &&
      !coverageBefore?.needsPlantBackfill
    ) {
      actions.push(
        `Stale BACnet-speil (> ${getMpcSdStaleSampleHours()} t siden siste prøve) — henter Influx`,
      );
    }
    const evalStart = coverageBefore
      ? new Date(coverageBefore.evalStart)
      : parseEvalStart();
    const evalEnd = coverageBefore
      ? new Date(coverageBefore.evalEnd)
      : getThesisEvalWindow().end ?? new Date();

    const pipeline = await runThesisMpcBackfillPipeline({
      buildingSlug: options.buildingSlug,
      sourceId: ctx.sourceId,
      evalStart,
      evalEnd,
      thresholdPct,
      allowDirectInflux,
      directInfluxMaxPages: options.directInfluxMaxPages ?? 80,
      skipFullSourceSync: options.skipFullSourceSync ?? false,
      maxSyncIterations: options.maxSyncIterations ?? 8,
      coverageFallback: coverageBefore,
    });
    actions.push(...pipeline.actions);
    coverageAfter = pipeline.coverage;
  }

  const dataOk =
    coverageAfter != null &&
    coverageAfter.stepCount >= 96 &&
    coverageAfter.uMeasPct >= thresholdPct;

  let effectiveEvalStart: Date | undefined;
  let effectiveEvalEnd: Date | undefined;
  let finalDataOk = dataOk;

  if (options.autoClipEvalStart !== false && coverageAfter) {
    const resolved = await resolveEffectiveEvalWindowForMpc({
      buildingSlug: options.buildingSlug,
      configuredStart: new Date(coverageAfter.evalStart),
      configuredEnd: new Date(coverageAfter.evalEnd),
      thresholdPct,
    });
    effectiveEvalStart = resolved.evalStart;
    effectiveEvalEnd = resolved.evalEnd;
    actions.push(...resolved.actions);
    if (resolved.clipped || resolved.stepCount != null) {
      coverageAfter =
        (await analyzeMpcEvalCoverageFull({
          buildingSlug: options.buildingSlug,
          evalStart: resolved.evalStart,
          evalEnd: resolved.evalEnd,
        })) ?? coverageAfter;
      finalDataOk =
        coverageAfter != null &&
        coverageAfter.stepCount >= 96 &&
        coverageAfter.uMeasPct >= thresholdPct;
    }
  }

  if (options.runSimulation) {
    if (!finalDataOk) {
      return {
        ok: false,
        actions,
        coverageBefore,
        coverageAfter,
        message: `Utilstrekkelig dekning (${Math.round((coverageAfter?.uMeasPct ?? 0) * 100)} % uMeas, terskel ${Math.round(thresholdPct * 100)} %)`,
      };
    }

    const simCtx = await resolveMpcBuildingSource({
      buildingSlug: options.buildingSlug,
    });
    if (!simCtx) {
      return {
        ok: false,
        actions,
        coverageBefore,
        coverageAfter,
        message: "Fant ikke bygg/kilde for simulering",
      };
    }

    const asyncSimulation = options.asyncSimulation !== false;
    if (asyncSimulation) {
      const previewDataset = await loadEvalDatasetForMpc({
        buildingSlug: simCtx.buildingSlug,
        evalStart: effectiveEvalStart,
        evalEnd: effectiveEvalEnd,
      });
      const queued = await enqueueAndScheduleMpcSimulationJob({
        buildingId: simCtx.buildingId,
        buildingSlug: simCtx.buildingSlug,
        stepTotal: previewDataset?.steps.length ?? 0,
        evalStart: effectiveEvalStart,
        evalEnd: effectiveEvalEnd,
        solverProfile: "thesis",
        message: "Kjører eval-replay…",
        forceRestart: options.forceSimulationRestart === true,
      });
      if (!queued.ok) {
        return {
          ok: false,
          actions,
          coverageBefore,
          coverageAfter,
          message: queued.reason,
        };
      }
      actions.push(
        queued.alreadyRunning
          ? "Simulering kjører allerede"
          : `Simulering startet (${queued.jobId.slice(0, 8)}…)`,
      );
      return {
        ok: true,
        actions,
        coverageBefore,
        coverageAfter,
        simulationJobId: queued.jobId,
        simulationQueued: true,
        message: queued.alreadyRunning
          ? "Simulering pågår allerede — følg progress i UI"
          : "Simulering startet i bakgrunnen",
      };
    }

    const simulation = await runMpcSimulationFromEvalDataset({
      buildingSlug: options.buildingSlug,
      evalStart: effectiveEvalStart,
      evalEnd: effectiveEvalEnd,
      buildingId: simCtx.buildingId,
    });

    if (!simulation.ok) {
      await markMpcSimulationFinished({
        buildingId: simCtx.buildingId,
        status: "failed",
        message: simulation.detail ?? simulation.reason,
      });
      return {
        ok: false,
        actions,
        coverageBefore,
        coverageAfter,
        simulation,
        message: `MPC-simulering feilet: ${simulation.reason}${simulation.detail ? ` (${simulation.detail})` : ""}`,
      };
    }

    const persisted = await persistMpcPipelineRun({
      buildingId: simCtx.buildingId,
      result: simulation.result,
    });

    await markMpcSimulationFinished({
      buildingId: simCtx.buildingId,
      status: "completed",
      pipelineRunId: persisted?.id ?? null,
      message: "Simulering fullført",
    });

    actions.push(`MPC replay persistert (${persisted?.id ?? "fil"})`);
    return {
      ok: true,
      actions,
      coverageBefore,
      coverageAfter,
      simulation,
      mpcRunId: persisted?.id ?? null,
      message: "Thesis MPC-data og simulering oppdatert",
    };
  }

  const influxNote = evalStartsBeforeInfluxLookback(
    coverageAfter ? new Date(coverageAfter.evalStart) : parseEvalStart(),
  )
    ? ` Eval eldre enn Influx (${resolveInfluxMaxLookbackHours()} t) — eldre data må ligge i Postgres fra sync.`
    : "";

  return {
    ok: finalDataOk || !needsData,
    actions,
    coverageBefore,
    coverageAfter,
    effectiveEvalStart: effectiveEvalStart?.toISOString(),
    effectiveEvalEnd: effectiveEvalEnd?.toISOString(),
    message: finalDataOk
      ? effectiveEvalStart
        ? `Thesis MPC-data dekker eval (${effectiveEvalStart.toISOString().slice(0, 10)} – ${(effectiveEvalEnd ?? new Date(coverageAfter!.evalEnd)).toISOString().slice(0, 10)})`
        : "Thesis MPC-data dekker eval-perioden"
      : `Dekning ${Math.round((coverageAfter?.uMeasPct ?? 0) * 100)} % — ${needsData ? "sync/Influx kjørt" : "utilstrekkelig"}.${influxNote}`,
  };
}

export async function ensureThesisMpcDataOnPageLoad(input: {
  buildingSlug: string;
  coverage: MpcEvalCoverageReport | null;
  hasMpcPipelineRun?: boolean;
}): Promise<{ triggered: boolean; actions: string[] }> {
  if (!shouldScheduleThesisMpcBackgroundEnsure(input)) {
    return { triggered: false, actions: [] };
  }

  const result = await ensureThesisMpcData({
    buildingSlug: input.buildingSlug,
    forceDataRefresh: input.coverage?.needsBackfill ?? true,
    runSimulation: !input.hasMpcPipelineRun,
    maxSyncIterations: 4,
    allowDirectInflux: true,
    directInfluxMaxPages: 32,
    autoClipEvalStart: true,
  });

  return { triggered: true, actions: result.actions };
}

export function shouldScheduleThesisMpcBackgroundEnsure(input: {
  coverage: MpcEvalCoverageReport | null;
  hasMpcPipelineRun?: boolean;
  simulationProgress?: MpcSimulationProgress | null;
}): boolean {
  if (!isMpcAutoEnsureEnabled()) return false;
  if (isInngestEnabled()) return false;
  if (input.simulationProgress?.status === "running") return false;
  if (!input.coverage) return true;
  if (input.coverage.missingCanonicals.length > 0) return true;
  if (input.coverage.needsBackfill) return true;
  if (!input.hasMpcPipelineRun && input.coverage.uMeasPct >= input.coverage.thresholdPct) {
    return true;
  }
  return false;
}

const backgroundEnsureInFlight = new Set<string>();
const backgroundEnsureLastAttempt = new Map<string, number>();

export function scheduleThesisMpcBackgroundEnsure(input: {
  buildingSlug: string;
  coverage: MpcEvalCoverageReport | null;
  hasMpcPipelineRun?: boolean;
  simulationProgress?: MpcSimulationProgress | null;
}): boolean {
  if (!shouldScheduleThesisMpcBackgroundEnsure(input)) {
    return false;
  }

  const { buildingSlug, coverage, hasMpcPipelineRun } = input;

  if (backgroundEnsureInFlight.has(buildingSlug)) {
    return false;
  }

  const lastAttempt = backgroundEnsureLastAttempt.get(buildingSlug) ?? 0;
  if (Date.now() - lastAttempt < MPC_BACKGROUND_ENSURE_COOLDOWN_MS) {
    return false;
  }

  backgroundEnsureInFlight.add(buildingSlug);
  backgroundEnsureLastAttempt.set(buildingSlug, Date.now());

  void ensureThesisMpcData({
    buildingSlug,
    forceDataRefresh: coverage?.needsBackfill ?? true,
    runSimulation: !hasMpcPipelineRun,
    asyncSimulation: true,
    maxSyncIterations: 2,
    allowDirectInflux: true,
    directInfluxMaxPages: 48,
    autoClipEvalStart: true,
  })
    .then((result) => {
      if (result.ok) {
        revalidateStyringWorkspace(buildingSlug);
      }
    })
    .finally(() => {
      backgroundEnsureInFlight.delete(buildingSlug);
    });

  return true;
}

export type { MpcEvalCoverageReport };
