import "server-only";

import { prisma } from "@/lib/db";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

/** Median fjernvarmepris fra BHCC for forward-plan og replay-fallback. */
export async function loadMedianHeatKrPerKwh(
  buildingId: string,
  since?: Date,
): Promise<number | null> {
  const sinceDate = since ?? new Date(Date.now() - 90 * 86400000);
  const rows = await prisma.buildingHourlyCostCache.findMany({
    where: {
      buildingId,
      hour: { gte: sinceDate },
      districtHeatingVolumeKwh: { gt: 0.05 },
    },
    select: {
      districtHeatingVolumeKwh: true,
      districtHeatingTotalCost: true,
      districtHeatingEffectCost: true,
    },
    take: 2000,
    orderBy: { hour: "desc" },
  });

  const prices: number[] = [];
  for (const row of rows) {
    const kwh = row.districtHeatingVolumeKwh ?? 0;
    if (kwh <= 0.05) continue;
    const kr =
      ((row.districtHeatingTotalCost ?? 0) +
        (row.districtHeatingEffectCost ?? 0)) /
      kwh;
    if (Number.isFinite(kr) && kr > 0 && kr < 5) prices.push(kr);
  }

  const med = median(prices);
  return med != null ? Math.round(med * 1000) / 1000 : null;
}
