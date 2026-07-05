#!/usr/bin/env bun
/**
 * Sletter data utenfor thesis case-bygg (idempotent).
 *
 * Usage:
 *   THESIS_DB_CONFIRM=1 BUILDING_SLUG=sorgenfriveien-32ab bun run thesis-db:retain
 */

import "dotenv/config";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import pg from "pg";
import { assertThesisDatabaseUrl, getNormalizedDatabaseUrl } from "../lib/config/thesis-db";

type FkRef = { tableName: string; columnName: string };

async function deleteReturningCount(
  client: pg.Client,
  sql: string,
  params: unknown[] = [],
): Promise<number> {
  const res = await client.query(sql, params);
  return res.rowCount ?? 0;
}

async function listForeignKeyRefs(
  client: pg.Client,
  referencedTable: string,
  referencedColumn: string,
): Promise<FkRef[]> {
  const res = await client.query<FkRef>(
    `SELECT DISTINCT
       tc.table_name AS "tableName",
       kcu.column_name AS "columnName"
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_schema = tc.constraint_schema
      AND ccu.constraint_name = tc.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = 'public'
       AND ccu.table_name = $1
       AND ccu.column_name = $2
     ORDER BY tc.table_name`,
    [referencedTable, referencedColumn],
  );
  return res.rows;
}

async function deleteRowsNotInSet(
  client: pg.Client,
  tableName: string,
  columnName: string,
  keepIds: string[],
  label: string,
): Promise<number> {
  if (keepIds.length === 0) {
    return deleteReturningCount(
      client,
      `DELETE FROM "${tableName}" WHERE "${columnName}" IS NOT NULL`,
    );
  }
  const n = await deleteReturningCount(
    client,
    `DELETE FROM "${tableName}" WHERE "${columnName}" <> ALL($1::text[])`,
    [keepIds],
  );
  if (n > 0) console.log(`[thesis-db:retain] ${label}: ${n} rader`);
  return n;
}

async function purgeMeteringPointsOutsideCase(
  client: pg.Client,
  caseBuildingId: string,
): Promise<void> {
  const keepRes = await client.query<{ id: string }>(
    `SELECT DISTINCT mp.id
     FROM metering_points mp
     LEFT JOIN metering_point_to_buildings mpb ON mpb."meteringPointId" = mp.id
     WHERE mp."buildingId" = $1 OR mpb."buildingId" = $1`,
    [caseBuildingId],
  );
  const keepIds = keepRes.rows.map((r) => r.id);
  console.log(
    `[thesis-db:retain] Beholder ${keepIds.length} målepunkter for case-bygg`,
  );

  const mpFkRefs = (await listForeignKeyRefs(client, "metering_points", "id"))
    .filter((ref) => ref.tableName !== "metering_points");

  console.log(
    `[thesis-db:retain] Rydder ${mpFkRefs.length} tabeller med meteringPointId-FK…`,
  );

  const heavyMeterTables = [
    "observations",
    "accumulated_observations",
    "provider_volume_observations",
    "observation_edit_logs",
    "district_heating_measurements",
    "electricity_hourly_cost_cache",
    "district_heating_hourly_cost_cache",
    "metering_point_daily_cache",
  ] as const;

  for (const table of heavyMeterTables) {
    console.log(`[thesis-db:retain] ${table}…`);
    await deleteRowsNotInSet(client, table, "meteringPointId", keepIds, table);
  }

  for (let pass = 1; pass <= 20; pass++) {
    let deleted = 0;
    for (const ref of mpFkRefs) {
      deleted += await deleteRowsNotInSet(
        client,
        ref.tableName,
        ref.columnName,
        keepIds,
        ref.tableName,
      );
    }
    if (deleted === 0) break;
    console.log(`[thesis-db:retain] meteringPointId pass ${pass}: ${deleted} rader`);
  }

  await deleteRowsNotInSet(
    client,
    "metering_points",
    "id",
    keepIds,
    "metering_points (andre MP)",
  );
}

async function deleteOtherBuildingRows(
  client: pg.Client,
  caseBuildingId: string,
  refs: FkRef[],
): Promise<number> {
  let total = 0;
  for (const ref of refs) {
    const col = `"${ref.columnName}"`;
    const n = await deleteReturningCount(
      client,
      `DELETE FROM "${ref.tableName}" WHERE ${col} <> $1`,
      [caseBuildingId],
    );
    if (n > 0) {
      console.log(`[thesis-db:retain] ${ref.tableName}: ${n} rader`);
      total += n;
    }
  }
  return total;
}

async function deleteOtherOrgRows(
  client: pg.Client,
  caseOrgIds: string[],
  refs: FkRef[],
): Promise<number> {
  let total = 0;
  for (const ref of refs) {
    const col = `"${ref.columnName}"`;
    const n = await deleteReturningCount(
      client,
      `DELETE FROM "${ref.tableName}" WHERE ${col} <> ALL($1::text[])`,
      [caseOrgIds],
    );
    if (n > 0) {
      console.log(`[thesis-db:retain] ${ref.tableName} (org): ${n} rader`);
      total += n;
    }
  }
  return total;
}

async function main() {
  if (process.env.THESIS_DB_CONFIRM !== "1") {
    console.error(
      "Destruktiv retain krever THESIS_DB_CONFIRM=1. Kjør thesis-db:verify først.",
    );
    process.exit(1);
  }

  assertThesisDatabaseUrl();

  const buildingSlug =
    resolveBuildingSlug();

  const client = new pg.Client({ connectionString: getNormalizedDatabaseUrl() });
  await client.connect();

  try {
    await client.query("BEGIN");

    const caseRes = await client.query<{ id: string }>(
      `SELECT id FROM buildings WHERE slug = $1 LIMIT 1`,
      [buildingSlug],
    );
    const caseBuildingId = caseRes.rows[0]?.id;
    if (!caseBuildingId) {
      throw new Error(`Case-bygg '${buildingSlug}' finnes ikke`);
    }

    console.log(`[thesis-db:retain] Case building: ${caseBuildingId}`);

    const orgRes = await client.query<{ organizationId: string }>(
      `SELECT DISTINCT "organizationId"
       FROM infraspawn_sources
       WHERE "buildingId" = $1`,
      [caseBuildingId],
    );
    const caseOrgIds = orgRes.rows.map((r) => r.organizationId);
    if (!caseOrgIds.length) {
      throw new Error(
        "Fant ingen organizationId via infraspawn_sources for case-bygg",
      );
    }

    console.log(`[thesis-db:retain] Case orgs: ${caseOrgIds.join(", ")}`);

    await purgeMeteringPointsOutsideCase(client, caseBuildingId);

    const buildingFkRefs = await listForeignKeyRefs(client, "buildings", "id");
    console.log(
      `[thesis-db:retain] Sletter rader i ${buildingFkRefs.length} tabeller med buildingId-FK…`,
    );
    for (let pass = 1; pass <= 20; pass++) {
      const deleted = await deleteOtherBuildingRows(
        client,
        caseBuildingId,
        buildingFkRefs,
      );
      if (deleted === 0) break;
      console.log(`[thesis-db:retain] buildingId pass ${pass}: ${deleted} rader totalt`);
    }

    const buildingDeleteCount = await deleteReturningCount(
      client,
      `DELETE FROM buildings WHERE id <> $1`,
      [caseBuildingId],
    );
    console.log(`[thesis-db:retain] buildings (andre bygg): ${buildingDeleteCount} rader`);

    const orgFkRefs = await listForeignKeyRefs(client, "organizations", "id");
    console.log(
      `[thesis-db:retain] Sletter rader i ${orgFkRefs.length} tabeller med organizationId-FK…`,
    );
    for (let pass = 1; pass <= 20; pass++) {
      const deleted = await deleteOtherOrgRows(client, caseOrgIds, orgFkRefs);
      if (deleted === 0) break;
      console.log(`[thesis-db:retain] organizationId pass ${pass}: ${deleted} rader totalt`);
    }

    await deleteReturningCount(
      client,
      `DELETE FROM organizations WHERE id <> ALL($1::text[])`,
      [caseOrgIds],
    );
    console.log("[thesis-db:retain] organizations (andre org): ferdig");

    // Behold globalt: hourly_energy_prices, weather_stations/observations, grid_tariffs

    await client.query("COMMIT");
    console.log("[thesis-db:retain] Ferdig");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[thesis-db:retain] FEIL:", error);
  process.exit(1);
});
