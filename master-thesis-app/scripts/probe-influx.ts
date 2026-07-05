#!/usr/bin/env bun
/**
 * Diagnostikk mot Influx v3 SQL-endepunkt — bruker .env (INFRASPAWN_*).
 * Kjør: bun run scripts/probe-influx.ts
 */
import "dotenv/config";
import { getInfraspawnInfluxHost } from "../lib/infraspawn/influx-host";
import { resolveInfluxTableName } from "../lib/infraspawn/influx-table";
import {
  buildInfluxBacnetLiveQuery,
  buildInfluxBacnetObjectIdFilter,
  INFLUX_BACNET_OBJECT_ID,
} from "../lib/infraspawn/influx-sql-fields";
import { resolveInfluxMaxLookbackHours } from "../lib/infraspawn/influx-lookback";
import { formatInfluxSqlTimeLiteral } from "../lib/infraspawn/influx-sql-time";
import { parseInfluxSqlResponse } from "../lib/infraspawn/parse-influx-rows";
import { prisma } from "../lib/db";
import { resolveInfluxApiToken } from "../services/infraspawn/source-influx-credentials";
import { MPC_CONTROL_CANONICALS } from "../services/mpc/mpc-canonicals";
import { CONTROL_SIGNAL_CATALOG_360102 } from "../lib/sd-anlegg/control/control-signal-catalog";
import { resolvePointForCatalogEntry } from "../lib/sd-anlegg/control/resolve-control-signals";
import type { InfraspawnPointListItem } from "../lib/infraspawn/types";

async function queryInflux(input: {
  host: string;
  token: string;
  database: string;
  sql: string;
}): Promise<{ ok: boolean; status: number; rows: ReturnType<typeof parseInfluxSqlResponse>; rawPreview: string; error?: string }> {
  const url = new URL(`${input.host.replace(/\/$/, "")}/api/v3/query_sql`);
  url.searchParams.set("db", input.database);
  url.searchParams.set("q", input.sql);
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const rawBody = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      rows: [],
      rawPreview: rawBody.slice(0, 500),
      error: rawBody.slice(0, 300).replace(/\s+/g, " "),
    };
  }

  const rows = parseInfluxSqlResponse(rawBody);
  return {
    ok: true,
    status: response.status,
    rows,
    rawPreview: rawBody.slice(0, 400),
  };
}

function summarize(label: string, result: Awaited<ReturnType<typeof queryInflux>>) {
  console.log(`\n--- ${label} ---`);
  console.log(`HTTP ${result.status} ok=${result.ok} parsedRows=${result.rows.length}`);
  if (result.error) console.log("Feil:", result.error);
  if (result.rows.length > 0) {
    const sample = result.rows[0]!;
    console.log("Første rad:", {
      objectId: sample.objectId,
      sampledAt: sample.sampledAt.toISOString(),
      valueNum: sample.valueNum,
      keys: Object.keys(sample.raw ?? {}).slice(0, 12),
    });
    const times = result.rows.map((r) => r.sampledAt.getTime());
    console.log("Tidsrom:", {
      min: new Date(Math.min(...times)).toISOString(),
      max: new Date(Math.max(...times)).toISOString(),
    });
    const objectIds = [...new Set(result.rows.map((r) => r.objectId))];
    console.log("Unike objectIds:", objectIds.length, objectIds.slice(0, 8));
  } else if (result.ok) {
    console.log("Raw preview:", result.rawPreview);
  }
}

async function main() {
  const host = getInfraspawnInfluxHost();
  const lookbackHours = resolveInfluxMaxLookbackHours();
  console.log("Host:", host);
  console.log("Lookback:", lookbackHours, "t");
  console.log("Env token satt:", Boolean(process.env.INFRASPAWN_API_TOKEN?.trim()));

  const source = await prisma.infraspawnSource.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      label: true,
      influxDatabase: true,
      apiTokenEncrypted: true,
      metadata: true,
    },
  });

  if (!source) {
    console.error("Ingen aktiv infraspawnSource i DB");
    process.exit(1);
  }

  const token = resolveInfluxApiToken(source.apiTokenEncrypted);
  const tableName = resolveInfluxTableName(source.metadata);
  console.log("Source:", { id: source.id, label: source.label, database: source.influxDatabase, tableName });

  const meta = await prisma.infraspawnBacnetPointMeta.findMany({
    where: { sourceId: source.id },
    select: { objectId: true, objectName: true, description: true },
  });

  const points: InfraspawnPointListItem[] = meta.map((row) => ({
    sourceId: source.id,
    sourceLabel: source.label,
    objectId: row.objectId,
    objectName: row.objectName,
    description: row.description,
    unit: null,
    lastValue: null,
    lastSampledAt: null,
    valueSource: "postgres-sync",
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
  }));

  const controlObjectIds = MPC_CONTROL_CANONICALS.map((canonicalId) => {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find((e) => e.canonicalId === canonicalId);
    if (!entry) return null;
    const point = resolvePointForCatalogEntry(points, entry);
    return point?.objectId ?? null;
  }).filter((id): id is string => id != null);

  console.log("Kontroll objectIds:", controlObjectIds);

  // 1) Enkel tail uten filter
  const tailSql = `SELECT * FROM ${tableName} WHERE time >= now() - INTERVAL '1 hour' ORDER BY time DESC LIMIT 5`;
  summarize("Tail 1t uten objectId-filter", await queryInflux({ host, token, database: source.influxDatabase, sql: tailSql }));

  // 2) Live query pattern (som appen bruker)
  if (controlObjectIds.length > 0) {
    const liveSql = buildInfluxBacnetLiveQuery({
      tableName,
      lookbackMinutes: 60,
      objectIds: controlObjectIds.slice(0, 3),
      order: "DESC",
      limit: 20,
    });
    console.log("\nLive SQL:", liveSql);
    summarize("Live query (3 kontrollsignaler)", await queryInflux({ host, token, database: source.influxDatabase, sql: liveSql }));
  }

  // 3) Range query (som sync bruker)
  const now = new Date();
  const start = new Date(now.getTime() - 2 * 3_600_000);
  const fromIso = formatInfluxSqlTimeLiteral(start);
  const untilIso = formatInfluxSqlTimeLiteral(now);
  const objectFilter = controlObjectIds.length > 0
    ? buildInfluxBacnetObjectIdFilter(controlObjectIds.slice(0, 3))
    : "";
  const rangeSql = `SELECT * FROM ${tableName} WHERE time > '${fromIso}' AND time <= '${untilIso}' ${objectFilter} ORDER BY time ASC LIMIT 100`;
  console.log("\nRange SQL:", rangeSql);
  summarize("Range 2t med objectId-filter", await queryInflux({ host, token, database: source.influxDatabase, sql: rangeSql }));

  // 4) Test uten quoted objectId (feil kolonnenavn?)
  if (controlObjectIds[0]) {
    const altSql = `SELECT * FROM ${tableName} WHERE time >= now() - INTERVAL '1 hour' AND object_id = '${controlObjectIds[0]}' ORDER BY time DESC LIMIT 5`;
    summarize("Alt kolonne object_id (snake_case)", await queryInflux({ host, token, database: source.influxDatabase, sql: altSql }));
  }

  // 5) SHOW / schema hint
  const countSql = `SELECT COUNT(*) AS cnt FROM ${tableName} WHERE time >= now() - INTERVAL '${lookbackHours} hours'`;
  summarize(`COUNT siste ${lookbackHours}t`, await queryInflux({ host, token, database: source.influxDatabase, sql: countSql }));

  // 6) objectId uten quotes
  if (controlObjectIds[0]) {
    const unquotedSql = `SELECT * FROM ${tableName} WHERE time >= now() - INTERVAL '1 hour' AND objectId = '${controlObjectIds[0]}' ORDER BY time DESC LIMIT 5`;
    summarize("objectId uten quotes i SQL", await queryInflux({ host, token, database: source.influxDatabase, sql: unquotedSql }));
  }

  console.log(`\nMerk: filter bruker ${INFLUX_BACNET_OBJECT_ID} i produksjon`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
