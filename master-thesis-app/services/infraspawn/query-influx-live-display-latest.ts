import "server-only";

import {
  buildInfluxBacnetSelectorLastBatchQuery,
  buildInfluxBacnetSingleLatestPointQuery,
} from "@/lib/infraspawn/influx-sql-fields";
import { getInfraspawnInfluxHost } from "@/lib/infraspawn/influx-host";
import {
  fetchInfluxLatestRowsByObjectIdChunks,
  objectIdsNeedingSelectorFallback,
  resolveInfluxTailCandidates,
} from "@/lib/infraspawn/live-point-influx-utils";
import {
  SD_ANLEGG_LIVE_INFLUX_OBJECT_QUERY_PARALLEL,
  SD_ANLEGG_LIVE_INFLUX_QUERY_LOOKBACK_HOURS,
  SD_ANLEGG_LIVE_INFLUX_STREAM_LOOKBACK_MINUTES,
} from "@/lib/infraspawn/live-display-policy";
import type { InfraspawnBacnetRow } from "@/lib/infraspawn/types";
import { queryInfluxSql } from "@/services/infraspawn/influx-query";

type InfluxQueryCredentials = {
  token: string;
  database: string;
  host?: string;
};

type InfluxObjectIdQueryInput = InfluxQueryCredentials & {
  tableName: string;
  objectIds: readonly string[];
  lookbackMinutes?: number;
  lookbackHours?: number;
};

async function queryInfluxRows(
  input: InfluxQueryCredentials,
  sql: string,
): Promise<InfraspawnBacnetRow[]> {
  const { rows } = await queryInfluxSql({
    host: input.host ?? getInfraspawnInfluxHost(),
    token: input.token,
    database: input.database,
    sql,
    format: "json",
  });
  return rows;
}

async function queryInfluxSingleLatestFallback(
  input: InfluxObjectIdQueryInput,
): Promise<InfraspawnBacnetRow[]> {
  if (input.objectIds.length === 0) return [];

  const rows: InfraspawnBacnetRow[] = [];
  const parallel = SD_ANLEGG_LIVE_INFLUX_OBJECT_QUERY_PARALLEL;

  for (let index = 0; index < input.objectIds.length; index += parallel) {
    const wave = input.objectIds.slice(index, index + parallel);
    const waveRows = await Promise.all(
      wave.map(async (objectId) => {
        try {
          const sql = buildInfluxBacnetSingleLatestPointQuery({
            tableName: input.tableName,
            objectId,
            lookbackHours: input.lookbackHours,
            lookbackMinutes: input.lookbackMinutes,
          });
          return await queryInfluxRows(input, sql);
        } catch {
          return [];
        }
      }),
    );
    for (const chunkRows of waveRows) {
      rows.push(...chunkRows);
    }
  }

  return rows;
}

async function queryInfluxSelectorLastWithFallback(
  input: InfluxObjectIdQueryInput,
): Promise<InfraspawnBacnetRow[]> {
  const { rows, chunks } = await fetchInfluxLatestRowsByObjectIdChunks(
    input.objectIds,
    async (objectIds) => {
      const sql = buildInfluxBacnetSelectorLastBatchQuery({
        tableName: input.tableName,
        objectIds,
        lookbackMinutes: input.lookbackMinutes,
        lookbackHours: input.lookbackHours,
      });
      return queryInfluxRows(input, sql);
    },
  );

  const fallbackObjectIds = objectIdsNeedingSelectorFallback(chunks);
  if (fallbackObjectIds.length === 0) {
    return rows;
  }

  const fallbackRows = await queryInfluxSingleLatestFallback({
    token: input.token,
    database: input.database,
    tableName: input.tableName,
    objectIds: fallbackObjectIds,
    lookbackHours: input.lookbackHours,
    lookbackMinutes: input.lookbackMinutes,
  });

  return [...rows, ...fallbackRows];
}

function mergeInfluxLatestPhaseRows(
  latestByObjectId: Map<string, InfraspawnBacnetRow>,
  foundObjectIds: Set<string>,
  rows: readonly InfraspawnBacnetRow[],
): void {
  for (const row of rows) {
    latestByObjectId.set(row.objectId, row);
    foundObjectIds.add(row.objectId);
  }
}

async function queryAndMergeInfluxLatestPhase(
  latestByObjectId: Map<string, InfraspawnBacnetRow>,
  foundObjectIds: Set<string>,
  phase: InfluxObjectIdQueryInput,
): Promise<void> {
  const rows = await queryInfluxSelectorLastWithFallback(phase);
  mergeInfluxLatestPhaseRows(latestByObjectId, foundObjectIds, rows);
}

export async function queryInfluxLiveDisplayLatestRows(input: {
  token: string;
  database: string;
  tableName: string;
  host?: string;
  objectIds: string[];
  streamLookbackMinutes?: number;
  tailLookbackHours?: number;
  tailObjectIds?: readonly string[];
}): Promise<InfraspawnBacnetRow[]> {
  if (input.objectIds.length === 0) return [];

  const streamLookbackMinutes =
    input.streamLookbackMinutes ?? SD_ANLEGG_LIVE_INFLUX_STREAM_LOOKBACK_MINUTES;
  const tailLookbackHours =
    input.tailLookbackHours ?? SD_ANLEGG_LIVE_INFLUX_QUERY_LOOKBACK_HOURS;

  const latestByObjectId = new Map<string, InfraspawnBacnetRow>();
  const foundObjectIds = new Set<string>();

  await queryAndMergeInfluxLatestPhase(latestByObjectId, foundObjectIds, {
    token: input.token,
    database: input.database,
    tableName: input.tableName,
    host: input.host,
    objectIds: input.objectIds,
    lookbackMinutes: streamLookbackMinutes,
  });

  const tailCandidates = resolveInfluxTailCandidates({
    tailObjectIds: input.tailObjectIds,
    foundObjectIds,
  });

  if (tailCandidates.length > 0) {
    await queryAndMergeInfluxLatestPhase(latestByObjectId, foundObjectIds, {
      token: input.token,
      database: input.database,
      tableName: input.tableName,
      host: input.host,
      objectIds: tailCandidates,
      lookbackHours: tailLookbackHours,
    });
  }

  return [...latestByObjectId.values()];
}
