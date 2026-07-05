import { prisma } from "@/lib/db";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { getSdCoverageThreshold } from "@/lib/config/thesis-eval";
import { utcDayMidnight, utcYmd } from "@/lib/energy-prices/day-utils";
import { CONTROL_SIGNAL_CATALOG_360102 } from "@/lib/sd-anlegg/control/control-signal-catalog";
import { SD_CALIBRATION_CANONICAL_IDS } from "@/lib/sd-anlegg/control/sd-calibration-ids";
import { resolvePointForCatalogEntry } from "@/lib/sd-anlegg/control/resolve-control-signals";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export type CoverageReport = {
  generatedAt: string;
  buildingSlug: string;
  sourceId: string;
  thresholdPct: number;
  resolvedSignalCount: number;
  resolvedSignals: Array<{ canonicalId: string; objectId: string }>;
  evalStart: string | null;
  evalEnd: string | null;
  totalHoursWithData: number;
  simulatableHours: number;
  recommendedEnv: {
    THESIS_EVAL_START: string | null;
    THESIS_EVAL_END: string | null;
  };
};

async function loadPointList(
  sourceId: string,
): Promise<InfraspawnPointListItem[]> {
  const metas = await prisma.infraspawnBacnetPointMeta.findMany({
    where: { sourceId },
    select: {
      sourceId: true,
      objectId: true,
      objectName: true,
      description: true,
      unit: true,
      rawMetadata: true,
    },
  });
  return metas.map((m) => ({
    sourceId: m.sourceId,
    sourceLabel: sourceId,
    objectId: m.objectId,
    objectName: m.objectName,
    description: m.description,
    unit: m.unit,
    lastValue: null,
    lastSampledAt: null,
    valueSource: "postgres-sync" as const,
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
  }));
}

export async function analyzeSdCoverage(input?: {
  buildingSlug?: string;
  threshold?: number;
}): Promise<CoverageReport> {
  const slug = input?.buildingSlug?.trim() || resolveBuildingSlug();

  const building = await prisma.building.findFirst({
    where: { slug },
    select: { id: true, slug: true },
  });
  if (!building) {
    throw new Error(`Fant ikke bygg med slug ${slug}`);
  }

  const source = await prisma.infraspawnSource.findFirst({
    where: { buildingId: building.id, isActive: true },
    select: { id: true },
    orderBy: { label: "asc" },
  });
  if (!source) {
    throw new Error(`Ingen aktiv Infraspawn-kilde for ${slug}`);
  }

  const points = await loadPointList(source.id);
  const resolved: Array<{ canonicalId: string; objectId: string }> = [];
  for (const canonicalId of SD_CALIBRATION_CANONICAL_IDS) {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === canonicalId,
    );
    if (!entry) continue;
    const point = resolvePointForCatalogEntry(points, entry);
    if (!point) continue;
    resolved.push({ canonicalId, objectId: point.objectId });
  }

  if (resolved.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      buildingSlug: slug,
      sourceId: source.id,
      thresholdPct: Math.round(getSdCoverageThreshold() * 100),
      resolvedSignalCount: 0,
      resolvedSignals: [],
      evalStart: null,
      evalEnd: null,
      totalHoursWithData: 0,
      simulatableHours: 0,
      recommendedEnv: { THESIS_EVAL_START: null, THESIS_EVAL_END: null },
    };
  }

  const objectIds = resolved.map((r) => r.objectId);
  const threshold = input?.threshold ?? getSdCoverageThreshold();
  const minSignals = Math.max(1, Math.ceil(resolved.length * threshold));

  const rows = await prisma.$queryRaw<
    Array<{ hour: Date; signal_count: bigint }>
  >`
    SELECT date_trunc('hour', "sampledAt") AS hour,
           COUNT(DISTINCT "objectId")::bigint AS signal_count
    FROM infraspawn_bacnet_samples
    WHERE "sourceId" = ${source.id}
      AND "objectId" = ANY(${objectIds})
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const simulatable = rows.filter(
    (r) => Number(r.signal_count) >= minSignals,
  );

  const evalStart =
    simulatable.length > 0 ? simulatable[0]!.hour : null;
  const evalEnd =
    simulatable.length > 0
      ? simulatable[simulatable.length - 1]!.hour
      : null;

  return {
    generatedAt: new Date().toISOString(),
    buildingSlug: slug,
    sourceId: source.id,
    thresholdPct: Math.round(threshold * 100),
    resolvedSignalCount: resolved.length,
    resolvedSignals: resolved,
    evalStart: evalStart?.toISOString() ?? null,
    evalEnd: evalEnd?.toISOString() ?? null,
    totalHoursWithData: rows.length,
    simulatableHours: simulatable.length,
    recommendedEnv: {
      THESIS_EVAL_START: evalStart ? utcYmd(utcDayMidnight(evalStart)) : null,
      THESIS_EVAL_END: evalEnd ? utcYmd(utcDayMidnight(evalEnd)) : null,
    },
  };
}
