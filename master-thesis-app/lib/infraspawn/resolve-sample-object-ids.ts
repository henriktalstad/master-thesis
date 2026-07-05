import "server-only";

import { normalizeInfraspawnObjectId } from "@/lib/infraspawn/point-location-label";
import { prisma } from "@/lib/db";

/**
 * Full meta-scan for normalized alias fallback.
 * Nærbyen (~hundrevis av punkter) er trygt; hopp over for store BACnet-kilder.
 */
export const FULL_META_SCAN_POINT_THRESHOLD = 2_000;

function applyNormalizedMatches(
  aliases: Map<string, string>,
  unique: readonly string[],
  metaRows: readonly { objectId: string }[],
): void {
  for (const row of metaRows) {
    const normalized = normalizeInfraspawnObjectId(row.objectId);
    for (const requested of unique) {
      if (normalizeInfraspawnObjectId(requested) === normalized) {
        aliases.set(requested, row.objectId);
      }
    }
  }
}

function isResolved(
  objectId: string,
  exactMeta: readonly { objectId: string }[],
): boolean {
  const normalized = normalizeInfraspawnObjectId(objectId);
  return exactMeta.some(
    (row) => normalizeInfraspawnObjectId(row.objectId) === normalized,
  );
}

export async function resolveSampleObjectIdAliases(
  sourceId: string,
  objectIds: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(objectIds.filter(Boolean))];
  const aliases = new Map<string, string>();
  if (unique.length === 0) return aliases;

  for (const objectId of unique) {
    aliases.set(objectId, objectId);
  }

  const exactMeta = await prisma.infraspawnBacnetPointMeta.findMany({
    where: {
      sourceId,
      objectId: { in: unique },
    },
    select: { objectId: true },
  });

  applyNormalizedMatches(aliases, unique, exactMeta);

  const unresolved = unique.filter((objectId) => !isResolved(objectId, exactMeta));
  if (unresolved.length === 0) {
    return aliases;
  }

  const metaCount = await prisma.infraspawnBacnetPointMeta.count({
    where: { sourceId },
  });
  if (metaCount > FULL_META_SCAN_POINT_THRESHOLD) {
    return aliases;
  }

  const allMeta = await prisma.infraspawnBacnetPointMeta.findMany({
    where: { sourceId },
    select: { objectId: true },
  });

  const byNormalized = new Map<string, string>();
  for (const row of allMeta) {
    const normalized = normalizeInfraspawnObjectId(row.objectId);
    if (!byNormalized.has(normalized)) {
      byNormalized.set(normalized, row.objectId);
    }
  }

  for (const requested of unresolved) {
    const canonical = byNormalized.get(normalizeInfraspawnObjectId(requested));
    if (canonical) aliases.set(requested, canonical);
  }

  return aliases;
}
