import "server-only";

import { createId } from "@paralleldrive/cuid2";
import type { Prisma } from "@/generated/client";
import { Prisma as PrismaNamespace } from "@/generated/client";
import {
  chunkRows,
  INFRASPAWN_SAMPLE_BATCH_SIZE,
} from "@/lib/infraspawn/chunk-rows";
import type { InfraspawnBacnetRow } from "@/lib/infraspawn/types";
import { prisma, withPrismaRetry } from "@/lib/db";

function toJsonb(raw: Record<string, unknown>): Prisma.InputJsonValue {
  return raw as Prisma.InputJsonValue;
}

export async function upsertMetaBatch(
  sourceId: string,
  rows: InfraspawnBacnetRow[],
): Promise<void> {
  const byObject = new Map<string, InfraspawnBacnetRow>();
  for (const row of rows) {
    byObject.set(row.objectId, row);
  }

  const uniqueRows = Array.from(byObject.values());
  if (uniqueRows.length === 0) return;

  const now = new Date();
  const chunks = chunkRows(uniqueRows, INFRASPAWN_SAMPLE_BATCH_SIZE);

  for (const chunk of chunks) {
    const valueTuples = PrismaNamespace.join(
      chunk.map(
        (row) =>
          PrismaNamespace.sql`(
            ${createId()},
            ${sourceId},
            ${row.objectId},
            ${row.objectName},
            ${row.description},
            ${row.unit},
            ${toJsonb(row.raw)},
            ${now},
            ${now}
          )`,
      ),
    );

    await withPrismaRetry(
      () =>
        prisma.$executeRaw`
        INSERT INTO "infraspawn_bacnet_point_meta" (
          "id", "sourceId", "objectId", "objectName", "description",
          "unit", "rawMetadata", "createdAt", "updatedAt"
        )
        VALUES ${valueTuples}
        ON CONFLICT ("sourceId", "objectId")
        DO UPDATE SET
          "objectName" = COALESCE(EXCLUDED."objectName", "infraspawn_bacnet_point_meta"."objectName"),
          "description" = COALESCE(EXCLUDED."description", "infraspawn_bacnet_point_meta"."description"),
          "unit" = COALESCE(EXCLUDED."unit", "infraspawn_bacnet_point_meta"."unit"),
          "rawMetadata" = EXCLUDED."rawMetadata",
          "updatedAt" = EXCLUDED."updatedAt"
      `,
      { retries: 5, delayMs: 200 },
    );
  }
}
