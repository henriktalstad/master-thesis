import type { InfraspawnBacnetRow } from "@/lib/infraspawn/types";
import {
  SD_ANLEGG_LIVE_INFLUX_BATCH_PARALLEL,
  SD_ANLEGG_LIVE_INFLUX_CHUNK_SIZE,
} from "@/lib/infraspawn/live-display-policy";

export type InfluxObjectIdChunkResult = {
  objectIds: readonly string[];
  rows: readonly InfraspawnBacnetRow[];
  failed: boolean;
};

export function chunkInfluxObjectIds(
  objectIds: readonly string[],
  chunkSize = SD_ANLEGG_LIVE_INFLUX_CHUNK_SIZE,
): string[][] {
  if (objectIds.length === 0) return [];
  const chunks: string[][] = [];
  for (let index = 0; index < objectIds.length; index += chunkSize) {
    chunks.push(objectIds.slice(index, index + chunkSize));
  }
  return chunks;
}

export function latestInfluxRowByObjectId(
  rows: readonly InfraspawnBacnetRow[],
): Map<string, InfraspawnBacnetRow> {
  const latest = new Map<string, InfraspawnBacnetRow>();
  for (const row of rows) {
    const objectId = row.objectId;
    if (!objectId) continue;
    const existing = latest.get(objectId);
    if (
      !existing ||
      row.sampledAt.getTime() > existing.sampledAt.getTime()
    ) {
      latest.set(objectId, row);
    }
  }
  return latest;
}

export function resolveInfluxTailCandidates(input: {
  tailObjectIds: readonly string[] | undefined;
  foundObjectIds: ReadonlySet<string>;
}): string[] {
  if (input.tailObjectIds === undefined) return [];
  return input.tailObjectIds.filter(
    (objectId) => !input.foundObjectIds.has(objectId),
  );
}

export function objectIdsNeedingSelectorFallback(
  chunks: readonly InfluxObjectIdChunkResult[],
): string[] {
  const missing = new Set<string>();

  for (const chunk of chunks) {
    if (chunk.failed) {
      for (const objectId of chunk.objectIds) {
        missing.add(objectId);
      }
      continue;
    }

    if (chunk.rows.length === 0) continue;

    const found = new Set(chunk.rows.map((row) => row.objectId));
    for (const objectId of chunk.objectIds) {
      if (!found.has(objectId)) {
        missing.add(objectId);
      }
    }
  }

  return [...missing];
}

export async function fetchInfluxLatestRowsByObjectIdChunks(
  objectIds: readonly string[],
  fetchChunk: (objectIds: string[]) => Promise<readonly InfraspawnBacnetRow[]>,
  options?: {
    chunkSize?: number;
    parallelChunks?: number;
  },
): Promise<{
  rows: InfraspawnBacnetRow[];
  chunks: InfluxObjectIdChunkResult[];
}> {
  if (objectIds.length === 0) {
    return { rows: [], chunks: [] };
  }

  const objectIdChunks = chunkInfluxObjectIds(
    objectIds,
    options?.chunkSize ?? SD_ANLEGG_LIVE_INFLUX_CHUNK_SIZE,
  );
  const parallelChunks =
    options?.parallelChunks ?? SD_ANLEGG_LIVE_INFLUX_BATCH_PARALLEL;
  const rows: InfraspawnBacnetRow[] = [];
  const chunks: InfluxObjectIdChunkResult[] = [];

  for (let index = 0; index < objectIdChunks.length; index += parallelChunks) {
    const wave = objectIdChunks.slice(index, index + parallelChunks);
    const waveResults = await Promise.all(
      wave.map(async (chunkObjectIds) => {
        try {
          const chunkRows = await fetchChunk(chunkObjectIds);
          const rowsForChunk = [
            ...latestInfluxRowByObjectId(chunkRows).values(),
          ];
          return {
            objectIds: chunkObjectIds,
            rows: rowsForChunk,
            failed: false,
          };
        } catch {
          return {
            objectIds: chunkObjectIds,
            rows: [],
            failed: true,
          };
        }
      }),
    );

    for (const chunk of waveResults) {
      chunks.push(chunk);
      rows.push(...chunk.rows);
    }
  }

  return { rows, chunks };
}

export function mergeInfluxRowsIntoLatestByKey(
  latestByKey: Map<string, { value: number | null; sampledAt: string }>,
  sourceId: string,
  rows: readonly InfraspawnBacnetRow[],
): void {
  for (const [objectId, row] of latestInfluxRowByObjectId(rows)) {
    const key = `${sourceId}:${objectId}`;
    const sampledAt = row.sampledAt.toISOString();
    const existing = latestByKey.get(key);
    if (!existing || sampledAt > existing.sampledAt) {
      latestByKey.set(key, { value: row.valueNum, sampledAt });
    }
  }
}
