import "server-only";

import { prisma } from "@/lib/db";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export type InfraspawnAlarmPointKey = {
  sourceId: string;
  objectId: string;
};

export function buildAlarmPointLookupKey(
  sourceId: string,
  objectId: string,
): string {
  return `${sourceId}:${objectId}`;
}

/** Billig meta-lookup for alarmvisning uten full Influx-enrichment. */
export async function loadPointMetaForAlarmKeys(
  keys: readonly InfraspawnAlarmPointKey[],
): Promise<Map<string, Pick<InfraspawnPointListItem, "objectName" | "description" | "unit">>> {
  const uniqueKeys = [...new Map(keys.map((key) => [buildAlarmPointLookupKey(key.sourceId, key.objectId), key])).values()];
  if (uniqueKeys.length === 0) return new Map();

  const rows = await prisma.infraspawnBacnetPointMeta.findMany({
    where: {
      OR: uniqueKeys.map((key) => ({
        sourceId: key.sourceId,
        objectId: key.objectId,
      })),
    },
    select: {
      sourceId: true,
      objectId: true,
      objectName: true,
      description: true,
      unit: true,
    },
  });

  return new Map(
    rows.map((row) => [
      buildAlarmPointLookupKey(row.sourceId, row.objectId),
      {
        objectName: row.objectName,
        description: row.description,
        unit: row.unit,
      },
    ]),
  );
}
