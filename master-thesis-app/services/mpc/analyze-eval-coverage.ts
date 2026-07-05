import "server-only";

import {
  getSdCoverageThreshold,
  getThesisEvalWindow,
  getMpcGapFillMaxSteps,
} from "@/lib/config/thesis-eval";
import { CONTROL_SIGNAL_CATALOG_360102 } from "@/lib/sd-anlegg/control/control-signal-catalog";
import { resolvePointForCatalogEntryInContext } from "@/lib/sd-anlegg/control/resolve-control-catalog";
import { resolveCoolingValveFeedbackObjectId } from "@/lib/sd-anlegg/control/resolve-cooling-valve-pct";
import { buildMpcTimeGrid, mpcStepKeyFromMs } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import { fillMpcStepGaps } from "@/lib/sd-anlegg/mpc/dataset/fill-step-gaps";
import { fillCoordinatedMpcChannelGaps } from "@/lib/sd-anlegg/mpc/dataset/fill-coordinated-channels";
import { prisma } from "@/lib/db";
import { loadEvalDatasetForMpc } from "./load-eval-dataset";
import { resolveMpcBuildingSource } from "./resolve-mpc-context";
import { loadMpcResolveContext } from "./load-mpc-resolve-context";
import { loadMpcAlarmActiveSteps } from "./load-mpc-alarm-steps";
import {
  buildMpcTimestepFromFilledSamples,
  countMpcStepCoverageMetrics,
} from "./mpc-step-coverage";
import {
  MPC_CONTROL_CANONICALS,
  MPC_EVAL_DATASET_CANONICALS,
  MPC_U_MEAS_CANONICAL_SET,
  type MpcControlCanonical,
} from "./mpc-canonicals";
import {
  analyzePlantMirrorCoverage,
  type PlantMirrorCoverageSignal,
} from "./analyze-plant-mirror-coverage";
import { buildEvalCoverageFlags } from "./eval-coverage-flags";
import { resolveMpcEvalBounds } from "./resolve-mpc-eval-bounds";
import { loadMpcDatasetProvenance } from "./load-dataset-provenance";
import {
  getElectricityZoneForBuilding,
  toMinimalBuildingForZone,
} from "@/lib/utils";
import type { EvalDatasetProvenance } from "@/lib/sd-anlegg/mpc/shared/types";

export type MpcEvalCoverageReport = {
  buildingId: string;
  sourceId: string;
  evalStart: string;
  evalEnd: string;
  stepCount: number;
  stepsWithUMeas: number;
  stepsOptimizable: number;
  optimizablePct: number;
  stepsWithExtractTemp: number;
  stepsWithOutdoorTemp: number;
  stepsWithPrice: number;
  uMeasPct: number;
  extractTempPct: number;
  thresholdPct: number;
  needsMpcBackfill: boolean;
  needsPlantBackfill: boolean;
  needsSampleRefresh: boolean;
  needsBackfill: boolean;
  resolvedSignalCount: number;
  missingCanonicals: string[];
  signals: Array<{
    canonicalId: string;
    objectId: string;
    sampleStepCount: number;
  }>;
  plantMirrorCoveragePct: number;
  plantMirrorStart: string;
  plantMirrorEnd: string;
  plantSignals: PlantMirrorCoverageSignal[];
  datasetProvenance: EvalDatasetProvenance | null;
};

async function resolveEvalWindow(input?: {
  buildingSlug?: string;
  evalStart?: Date;
  evalEnd?: Date;
}) {
  const bounds = await resolveMpcEvalBounds({
    buildingSlug: input?.buildingSlug,
    evalStart: input?.evalStart,
    evalEnd: input?.evalEnd,
  });
  if (bounds) {
    return { evalStart: bounds.evalStart, evalEnd: bounds.evalEnd };
  }
  const thesisWindow = getThesisEvalWindow();
  const now = new Date();
  const evalStart =
    input?.evalStart ??
    thesisWindow.start ??
    new Date(Date.now() - 14 * 86400000);
  let evalEnd = input?.evalEnd ?? thesisWindow.end ?? now;
  if (evalEnd.getTime() > now.getTime()) evalEnd = now;
  return { evalStart, evalEnd };
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function resolveEvalDatasetSignals(input: {
  points: Awaited<ReturnType<typeof loadMpcResolveContext>>["points"];
  context: Awaited<ReturnType<typeof loadMpcResolveContext>>;
}): Array<{ canonicalId: string; objectId: string }> {
  return MPC_EVAL_DATASET_CANONICALS.flatMap((canonicalId) => {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === canonicalId,
    );
    if (!entry) return [];
    const point = resolvePointForCatalogEntryInContext({
      points: input.points,
      entry,
      context: input.context,
    });
    if (!point) return [];
    return [{ canonicalId, objectId: point.objectId }];
  });
}

/**
 * Finner tidligste evalStart (nærmest konfigurert start) der uMeas-dekning
 * når terskelen innen [start, evalEnd]. Dekning øker typisk når start flyttes fremover.
 */
export async function findEvalStartMeetingCoverage(input: {
  buildingSlug?: string;
  configuredStart: Date;
  evalEnd: Date;
  thresholdPct?: number;
  maxSearchDays?: number;
  /** Bruk full eval-datasett (pris/vær) — anbefalt for thesis-simulering. */
  useFullDataset?: boolean;
}): Promise<{ evalStart: Date; uMeasPct: number; stepCount: number } | null> {
  const thresholdPct = input.thresholdPct ?? getSdCoverageThreshold();
  const maxDays = input.maxSearchDays ?? 120;
  let candidate = input.configuredStart;
  const endMs = input.evalEnd.getTime();

  for (let day = 0; day <= maxDays; day++) {
    if (candidate.getTime() >= endMs) break;

    const report =
      input.useFullDataset === true
        ? await analyzeMpcEvalCoverageFull({
            buildingSlug: input.buildingSlug,
            evalStart: candidate,
            evalEnd: input.evalEnd,
          })
        : await analyzeMpcEvalCoverage({
            buildingSlug: input.buildingSlug,
            evalStart: candidate,
            evalEnd: input.evalEnd,
          });

    if (
      report &&
      report.stepCount >= 96 &&
      report.uMeasPct >= thresholdPct
    ) {
      return {
        evalStart: candidate,
        uMeasPct: report.uMeasPct,
        stepCount: report.stepCount,
      };
    }

    candidate = addUtcDays(candidate, 1);
  }

  return null;
}

export async function analyzeMpcEvalCoverage(input?: {
  buildingSlug?: string;
  evalStart?: Date;
  evalEnd?: Date;
}): Promise<MpcEvalCoverageReport | null> {
  const ctx = await resolveMpcBuildingSource({
    buildingSlug: input?.buildingSlug,
  });
  if (!ctx) return null;

  const { evalStart, evalEnd } = await resolveEvalWindow(input);
  const thresholdPct = getSdCoverageThreshold();
  const grid = buildMpcTimeGrid(evalStart, evalEnd);
  const stepCount = grid.length;

  const building = await prisma.building.findUnique({
    where: { id: ctx.buildingId },
    select: {
      municipalityNumber: true,
      region: true,
      postCode: true,
      postalPlace: true,
      latitude: true,
      longitude: true,
    },
  });
  const { zone } = getElectricityZoneForBuilding(
    toMinimalBuildingForZone(building ?? {}),
  );

  const mpcCtx = await loadMpcResolveContext({
    buildingId: ctx.buildingId,
    buildingSlug: input?.buildingSlug ?? ctx.buildingSlug,
    sourceId: ctx.sourceId,
  });
  const points = mpcCtx.points;
  const plantMirror = await analyzePlantMirrorCoverage({
    sourceId: ctx.sourceId,
    points,
    context: mpcCtx,
  });
  const resolved = MPC_CONTROL_CANONICALS.map((canonicalId) => {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === canonicalId,
    );
    if (!entry) return null;
    const point = resolvePointForCatalogEntryInContext({
      points,
      entry,
      context: mpcCtx,
    });
    if (!point) return null;
    return { canonicalId, objectId: point.objectId };
  }).filter(
    (row): row is { canonicalId: MpcControlCanonical; objectId: string } =>
      row != null,
  );
  const evalDatasetResolved = resolveEvalDatasetSignals({
    points,
    context: mpcCtx,
  });

  const missingCanonicals = MPC_CONTROL_CANONICALS.filter(
    (id) => !resolved.some((r) => r.canonicalId === id),
  );

  if (resolved.length === 0) {
    const datasetProvenance = await loadMpcDatasetProvenance({
      buildingId: ctx.buildingId,
      sourceId: ctx.sourceId,
      evalStart,
      evalEnd,
      sampleObjectIds: [],
      areaCode: zone === "ukjent" ? null : zone,
    });
    const flags = buildEvalCoverageFlags({
      uMeasPct: 0,
      plantNeedsBackfill: plantMirror.plantNeedsBackfill,
      thresholdPct,
      latestSampleAt:
        datasetProvenance.tables.infraspawnBacnetSample.latestSampleAt,
      evalEnd,
    });
    return {
      buildingId: ctx.buildingId,
      sourceId: ctx.sourceId,
      evalStart: evalStart.toISOString(),
      evalEnd: evalEnd.toISOString(),
      stepCount,
      stepsWithUMeas: 0,
      stepsOptimizable: 0,
      optimizablePct: 0,
      stepsWithExtractTemp: 0,
      stepsWithOutdoorTemp: 0,
      stepsWithPrice: 0,
      uMeasPct: 0,
      extractTempPct: 0,
      thresholdPct,
      needsMpcBackfill: true,
      needsPlantBackfill: flags.needsPlantBackfill,
      needsSampleRefresh: flags.needsSampleRefresh,
      needsBackfill: true,
      resolvedSignalCount: 0,
      missingCanonicals: [...missingCanonicals],
      signals: [],
      plantMirrorCoveragePct: plantMirror.plantMirrorCoveragePct,
      plantMirrorStart: plantMirror.mirrorStart,
      plantMirrorEnd: plantMirror.mirrorEnd,
      plantSignals: plantMirror.signals,
      datasetProvenance,
    };
  }

  const objectIds = resolved.map((r) => r.objectId);
  const evalObjectIds = evalDatasetResolved.map((r) => r.objectId);
  const coolingFeedbackObjectId = resolveCoolingValveFeedbackObjectId(points);
  const queryObjectIds = [
    ...new Set([
      ...objectIds,
      ...evalObjectIds,
      ...(coolingFeedbackObjectId ? [coolingFeedbackObjectId] : []),
    ]),
  ];
  const rows = await prisma.infraspawnBacnetSample.findMany({
    where: {
      sourceId: ctx.sourceId,
      objectId: { in: queryObjectIds },
      resolution: "15m",
      sampledAt: { gte: evalStart, lte: evalEnd },
      valueNum: { not: null },
    },
    select: { objectId: true, sampledAt: true, valueNum: true },
  });

  const gapFillMax = getMpcGapFillMaxSteps();
  const stepsByObject = new Map<string, Map<string, number>>();
  for (const objectId of queryObjectIds) {
    stepsByObject.set(objectId, new Map());
  }
  for (const { objectId, sampledAt, valueNum } of rows) {
    if (valueNum == null) continue;
    const key = mpcStepKeyFromMs(sampledAt.getTime());
    const bucket = stepsByObject.get(objectId)!;
    const prev = bucket.get(key);
    if (prev == null) {
      bucket.set(key, valueNum);
    } else {
      bucket.set(key, Math.round(((prev + valueNum) / 2) * 100) / 100);
    }
  }

  const filledByObject = new Map<string, Map<string, number>>();
  const uMeasObjectIds: string[] = [];
  let extractObjectId: string | undefined;

  for (const row of resolved) {
    if (MPC_U_MEAS_CANONICAL_SET.has(row.canonicalId)) {
      uMeasObjectIds.push(row.objectId);
    }
    if (row.canonicalId === "extract.temp") {
      extractObjectId = row.objectId;
    }
  }

  for (const [objectId, raw] of stepsByObject) {
    const isUMeas = uMeasObjectIds.includes(objectId);
    if (isUMeas) continue;
    const { filled } =
      gapFillMax > 0
        ? fillMpcStepGaps(grid, raw, {
            maxForwardSteps: gapFillMax,
            maxBackwardSteps: gapFillMax,
          })
        : { filled: raw };
    filledByObject.set(objectId, filled);
  }

  if (uMeasObjectIds.length > 0) {
    const channels = new Map<string, ReadonlyMap<string, number>>();
    for (const objectId of uMeasObjectIds) {
      channels.set(objectId, stepsByObject.get(objectId) ?? new Map());
    }
    const coordinated =
      gapFillMax > 0
        ? fillCoordinatedMpcChannelGaps(grid, channels, uMeasObjectIds, {
            maxForwardSteps: gapFillMax,
            maxBackwardSteps: gapFillMax,
          })
        : new Map(uMeasObjectIds.map((id) => [id, stepsByObject.get(id)!]));
    for (const [objectId, filled] of coordinated) {
      filledByObject.set(objectId, filled);
    }
  }

  const objectIdByCanonical = new Map(
    resolved.map((row) => [row.canonicalId, row.objectId]),
  );

  const [alarmActiveSteps] = await Promise.all([
    loadMpcAlarmActiveSteps({
      buildingId: ctx.buildingId,
      evalStart,
      evalEnd,
      grid,
    }),
  ]);

  const timesteps = buildMpcTimestepFromFilledSamples({
    grid,
    filledByObjectId: filledByObject,
    objectIdByCanonical,
    weatherByHour: new Map(),
    alarmActiveSteps,
    coolingFeedbackObjectId,
  });

  const coverageMetrics = countMpcStepCoverageMetrics(timesteps);
  let stepsWithExtractTemp = 0;
  if (extractObjectId) {
    const extractSteps = filledByObject.get(extractObjectId);
    for (const step of grid) {
      if (extractSteps?.has(step)) stepsWithExtractTemp += 1;
    }
  }

  const signals = evalDatasetResolved.map(({ canonicalId, objectId }) => ({
    canonicalId,
    objectId,
    sampleStepCount: filledByObject.get(objectId)?.size ?? 0,
  }));

  const uMeasPct = coverageMetrics.uMeasPct;
  const extractTempPct = stepCount > 0 ? stepsWithExtractTemp / stepCount : 0;

  const datasetProvenance = await loadMpcDatasetProvenance({
    buildingId: ctx.buildingId,
    sourceId: ctx.sourceId,
    evalStart,
    evalEnd,
    sampleObjectIds: queryObjectIds,
    areaCode: zone === "ukjent" ? null : zone,
  });

  const flags = buildEvalCoverageFlags({
    uMeasPct,
    plantNeedsBackfill: plantMirror.plantNeedsBackfill,
    thresholdPct,
    latestSampleAt:
      datasetProvenance.tables.infraspawnBacnetSample.latestSampleAt,
    evalEnd,
  });

  return {
    buildingId: ctx.buildingId,
    sourceId: ctx.sourceId,
    evalStart: evalStart.toISOString(),
    evalEnd: evalEnd.toISOString(),
    stepCount,
    stepsWithUMeas: coverageMetrics.stepsWithUMeas,
    stepsOptimizable: coverageMetrics.optimizableSteps,
    optimizablePct: coverageMetrics.optimizablePct,
    stepsWithExtractTemp,
    stepsWithOutdoorTemp: 0,
    stepsWithPrice: 0,
    uMeasPct,
    extractTempPct,
    thresholdPct,
    ...flags,
    resolvedSignalCount: resolved.length,
    missingCanonicals: [...missingCanonicals],
    signals,
    plantMirrorCoveragePct: plantMirror.plantMirrorCoveragePct,
    plantMirrorStart: plantMirror.mirrorStart,
    plantMirrorEnd: plantMirror.mirrorEnd,
    plantSignals: plantMirror.signals,
    datasetProvenance,
  };
}

export async function analyzeMpcEvalCoverageFull(input?: {
  buildingSlug?: string;
  evalStart?: Date;
  evalEnd?: Date;
}): Promise<MpcEvalCoverageReport | null> {
  const dataset = await loadEvalDatasetForMpc({
    buildingSlug: input?.buildingSlug,
    evalStart: input?.evalStart,
    evalEnd: input?.evalEnd,
  });
  if (!dataset) return null;

  const thresholdPct = getSdCoverageThreshold();
  const { coverage } = dataset;
  const uMeasPct =
    coverage.stepCount > 0 ? coverage.stepsWithUMeas / coverage.stepCount : 0;
  const extractTempPct =
    coverage.stepCount > 0
      ? coverage.stepsWithExtractTemp / coverage.stepCount
      : 0;

  const flags = buildEvalCoverageFlags({
    uMeasPct,
    plantNeedsBackfill: false,
    thresholdPct,
    latestSampleAt:
      dataset.provenance?.tables.infraspawnBacnetSample.latestSampleAt ?? null,
    evalEnd: dataset.evalEnd,
  });

  return {
    buildingId: dataset.buildingId,
    sourceId: dataset.sourceId,
    evalStart: dataset.evalStart,
    evalEnd: dataset.evalEnd,
    stepCount: coverage.stepCount,
    stepsWithUMeas: coverage.stepsWithUMeas,
    stepsOptimizable: coverage.stepsOptimizable,
    optimizablePct: coverage.optimizablePct,
    stepsWithExtractTemp: coverage.stepsWithExtractTemp,
    stepsWithOutdoorTemp: coverage.stepsWithOutdoorTemp,
    stepsWithPrice: coverage.stepsWithPrice,
    uMeasPct,
    extractTempPct,
    thresholdPct,
    ...flags,
    resolvedSignalCount: 0,
    missingCanonicals: [],
    signals: [],
    plantMirrorCoveragePct: 0,
    plantMirrorStart: "",
    plantMirrorEnd: "",
    plantSignals: [],
    datasetProvenance: dataset.provenance,
  };
}
