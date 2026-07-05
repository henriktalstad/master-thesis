import "server-only";

import { getSdCoverageThreshold } from "@/lib/config/thesis-eval";
import {
  clipRangeToInfluxLookback,
  resolveInfluxMaxLookbackHours,
} from "@/lib/infraspawn/influx-lookback";
import { SERIES_GAP_BUCKET_MS } from "@/lib/infraspawn/detect-series-gaps";
import { CONTROL_SIGNAL_CATALOG_360102 } from "@/lib/sd-anlegg/control/control-signal-catalog";
import {
  resolvePointForCatalogEntryInContext,
  type ControlResolveContext,
} from "@/lib/sd-anlegg/control/resolve-control-catalog";
import { prisma } from "@/lib/db";
import {
  MPC_PLANT_OBSERVATION_CANONICALS,
} from "./mpc-canonicals";
import type { listMpcPointMeta } from "./mpc-point-meta";

export type PlantMirrorCoverageSignal = {
  canonicalId: string;
  objectId: string;
  sampleBucketCount: number;
  expectedBucketCount: number;
  coveragePct: number;
};

export type PlantMirrorCoverageReport = {
  mirrorStart: string;
  mirrorEnd: string;
  expectedBucketCount: number;
  plantMirrorCoveragePct: number;
  plantNeedsBackfill: boolean;
  thresholdPct: number;
  signals: PlantMirrorCoverageSignal[];
};

function countExpectedBuckets(startMs: number, endMs: number): number {
  if (endMs <= startMs) return 0;
  return Math.max(1, Math.ceil((endMs - startMs) / SERIES_GAP_BUCKET_MS));
}

export async function analyzePlantMirrorCoverage(input: {
  sourceId: string;
  points: Awaited<ReturnType<typeof listMpcPointMeta>>;
  context?: ControlResolveContext;
  now?: Date;
}): Promise<PlantMirrorCoverageReport> {
  const thresholdPct = getSdCoverageThreshold();
  const now = input.now ?? new Date();
  const clipped = clipRangeToInfluxLookback({
    start: new Date(now.getTime() - resolveInfluxMaxLookbackHours() * 3_600_000),
    end: now,
    now,
  });

  const mirrorStart = clipped.start;
  const mirrorEnd = clipped.end;
  const startMs = mirrorStart.getTime();
  const endMs = mirrorEnd.getTime();
  const expectedBucketCount = countExpectedBuckets(startMs, endMs);

  const resolved = MPC_PLANT_OBSERVATION_CANONICALS.flatMap((canonicalId) => {
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

  if (resolved.length === 0 || !clipped.queryable || expectedBucketCount === 0) {
    return {
      mirrorStart: mirrorStart.toISOString(),
      mirrorEnd: mirrorEnd.toISOString(),
      expectedBucketCount,
      plantMirrorCoveragePct: 0,
      plantNeedsBackfill: true,
      thresholdPct,
      signals: [],
    };
  }

  const objectIds = resolved.map((row) => row.objectId);
  const rows = await prisma.infraspawnBacnetSample.findMany({
    where: {
      sourceId: input.sourceId,
      objectId: { in: objectIds },
      resolution: "15m",
      sampledAt: { gte: mirrorStart, lte: mirrorEnd },
      valueNum: { not: null },
    },
    select: { objectId: true, sampledAt: true },
  });

  const bucketsByObject = new Map<string, Set<number>>();
  for (const objectId of objectIds) {
    bucketsByObject.set(objectId, new Set());
  }
  for (const row of rows) {
    const bucketMs =
      Math.floor(row.sampledAt.getTime() / SERIES_GAP_BUCKET_MS) *
      SERIES_GAP_BUCKET_MS;
    bucketsByObject.get(row.objectId)?.add(bucketMs);
  }

  const signals: PlantMirrorCoverageSignal[] = resolved.map(
    ({ canonicalId, objectId }) => {
      const sampleBucketCount = bucketsByObject.get(objectId)?.size ?? 0;
      const coveragePct =
        expectedBucketCount > 0 ? sampleBucketCount / expectedBucketCount : 0;
      return {
        canonicalId,
        objectId,
        sampleBucketCount,
        expectedBucketCount,
        coveragePct,
      };
    },
  );

  const plantMirrorCoveragePct =
    signals.length > 0
      ? signals.reduce((sum, signal) => sum + signal.coveragePct, 0) /
        signals.length
      : 0;

  return {
    mirrorStart: mirrorStart.toISOString(),
    mirrorEnd: mirrorEnd.toISOString(),
    expectedBucketCount,
    plantMirrorCoveragePct,
    plantNeedsBackfill: plantMirrorCoveragePct < thresholdPct,
    thresholdPct,
    signals,
  };
}
