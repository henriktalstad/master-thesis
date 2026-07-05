import { prisma } from "@/lib/db";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export async function listMpcPointMeta(
  sourceId: string,
): Promise<InfraspawnPointListItem[]> {
  const rows = await prisma.infraspawnBacnetPointMeta.findMany({
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
  return rows.map((row) => ({
    sourceId: row.sourceId,
    sourceLabel: row.sourceId,
    objectId: row.objectId,
    objectName: row.objectName,
    description: row.description,
    unit: row.unit,
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
