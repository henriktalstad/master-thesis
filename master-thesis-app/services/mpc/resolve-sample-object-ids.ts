import { normalizeInfraspawnObjectId } from "@/lib/infraspawn/point-location-label";
import { prisma } from "@/lib/db";

/** CLI/script-vennlig variant uten server-only. */
export async function resolveSampleObjectIdAliasesForMpc(
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
    where: { sourceId, objectId: { in: unique } },
    select: { objectId: true },
  });

  for (const row of exactMeta) {
    const normalized = normalizeInfraspawnObjectId(row.objectId);
    for (const requested of unique) {
      if (normalizeInfraspawnObjectId(requested) === normalized) {
        aliases.set(requested, row.objectId);
      }
    }
  }

  return aliases;
}
