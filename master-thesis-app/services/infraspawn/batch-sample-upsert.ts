import "server-only";

import { createId } from "@paralleldrive/cuid2";
import type { Prisma } from "@/generated/client";
import { Prisma as PrismaNamespace } from "@/generated/client";
import type { AggregatedBacnetRow } from "@/lib/infraspawn/bucket-aggregate";
import {
  chunkRows,
  INFRASPAWN_SAMPLE_BATCH_SIZE,
} from "@/lib/infraspawn/chunk-rows";
import type { InfraspawnSampleResolution } from "@/lib/infraspawn/resolution";
import { prisma, withPrismaRetry } from "@/lib/db";

function toJsonb(raw: Record<string, unknown>): Prisma.InputJsonValue {
  return raw as Prisma.InputJsonValue;
}

export async function upsertSampleBatch(
  sourceId: string,
  rows: AggregatedBacnetRow[],
  resolution: InfraspawnSampleResolution,
): Promise<void> {
  if (rows.length === 0) return;

  const now = new Date();
  const chunks = chunkRows(rows, INFRASPAWN_SAMPLE_BATCH_SIZE);

  for (const chunk of chunks) {
    const valueTuples = PrismaNamespace.join(
      chunk.map(
        (row) =>
          PrismaNamespace.sql`(${createId()}, ${sourceId}, ${row.objectId}, ${row.sampledAt}, ${resolution}, ${row.valueNum}, ${row.quality}, ${row.sampleCount}, ${toJsonb(row.raw)}, ${now})`,
      ),
    );

    await withPrismaRetry(
      () =>
        prisma.$executeRaw`
        INSERT INTO "infraspawn_bacnet_samples" (
          "id", "sourceId", "objectId", "sampledAt", "resolution",
          "valueNum", "quality", "sampleCount", "raw", "createdAt"
        )
        VALUES ${valueTuples}
        ON CONFLICT ("sourceId", "objectId", "sampledAt", "resolution")
        DO UPDATE SET
          "valueNum" = EXCLUDED."valueNum",
          "quality" = EXCLUDED."quality",
          "sampleCount" = EXCLUDED."sampleCount",
          "raw" = EXCLUDED."raw"
      `,
      { retries: 5, delayMs: 200 },
    );
  }
}
