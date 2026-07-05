import "server-only";

import { getInfraspawnInfluxHost } from "@/lib/infraspawn/influx-host";
import { buildInfluxBacnetLiveQuery } from "@/lib/infraspawn/influx-sql-fields";
import { resolveInfluxMaxLookbackHours } from "@/lib/infraspawn/bucket-aggregate";
import {
  SD_ANLEGG_INFLUX_TAIL_MAX_HOURS,
  SD_ANLEGG_LIST_LOOKBACK_MINUTES,
} from "@/lib/infraspawn/sd-anlegg-chart-policy";
import type { InfraspawnBacnetRow } from "@/lib/infraspawn/types";
import { queryInfluxSql } from "@/services/infraspawn/influx-query";

export {
  queryInfluxLiveDisplayLatestRows,
} from "@/services/infraspawn/query-influx-live-display-latest";

const MAX_LIVE_ROWS = 10_000;
/** Server-side fin SD (styring 1/5 min) — flere signaler × flere steg. */
const MAX_CONTROL_FINE_ROWS = 250_000;

export type InfraspawnSourceInfluxCredentials = {
  id: string;
  label?: string | null;
  influxDatabase: string;
  apiTokenEncrypted: string;
  metadata: unknown;
};

export async function queryInfluxLivePointRows(input: {
  token: string;
  database: string;
  tableName: string;
  objectIds: string[];
  hours?: number;
  lookbackMinutes?: number;
  maxRows?: number;
}): Promise<InfraspawnBacnetRow[]> {
  if (input.objectIds.length === 0) return [];

  const maxMinutes = resolveInfluxMaxLookbackHours() * 60;
  const lookbackMinutes = Math.min(
    Math.max(
      input.lookbackMinutes ??
        (input.hours ?? SD_ANLEGG_INFLUX_TAIL_MAX_HOURS) * 60,
      1,
    ),
    maxMinutes,
  );
  const rowLimit = Math.min(
    Math.max(input.maxRows ?? MAX_LIVE_ROWS, 1),
    input.maxRows != null ? MAX_CONTROL_FINE_ROWS : MAX_LIVE_ROWS,
  );
  const sql = buildInfluxBacnetLiveQuery({
    tableName: input.tableName,
    lookbackMinutes,
    objectIds: input.objectIds,
    order: "ASC",
    limit: rowLimit,
  });

  const { rows } = await queryInfluxSql({
    host: getInfraspawnInfluxHost(),
    token: input.token,
    database: input.database,
    sql,
    format: "json",
  });

  return rows;
}

export async function queryInfluxRecentSamplesForSource(input: {
  token: string;
  database: string;
  tableName: string;
  objectIds: string[];
  lookbackMinutes?: number;
  maxRows?: number;
  /** Øvre grense for visnings-overlay (default 2t); kan settes til 24t for read-only live. */
  maxLookbackMinutes?: number;
}): Promise<InfraspawnBacnetRow[]> {
  if (input.objectIds.length === 0) return [];

  const maxMinutes = Math.min(
    Math.max(
      input.maxLookbackMinutes ?? SD_ANLEGG_INFLUX_TAIL_MAX_HOURS * 60,
      1,
    ),
    resolveInfluxMaxLookbackHours() * 60,
  );
  const minutes = Math.min(
    Math.max(
      input.lookbackMinutes ?? SD_ANLEGG_LIST_LOOKBACK_MINUTES,
      1,
    ),
    maxMinutes,
  );
  const rowLimit = Math.min(
    Math.max(input.maxRows ?? MAX_LIVE_ROWS, 1),
    MAX_LIVE_ROWS,
  );
  const sql = buildInfluxBacnetLiveQuery({
    tableName: input.tableName,
    lookbackMinutes: minutes,
    objectIds: input.objectIds,
    order: "DESC",
    limit: rowLimit,
  });

  const { rows } = await queryInfluxSql({
    host: getInfraspawnInfluxHost(),
    token: input.token,
    database: input.database,
    sql,
    format: "json",
  });

  return rows;
}

/** @deprecated Bruk queryInfluxLiveDisplayLatestRows */
export { queryInfluxLiveDisplayLatestRows as queryInfluxLatestValueRowsForSource } from "@/services/infraspawn/query-influx-live-display-latest";
