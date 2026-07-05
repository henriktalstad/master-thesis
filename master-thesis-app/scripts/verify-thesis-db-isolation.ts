#!/usr/bin/env bun
/**
 * Preflight: verifiser at DATABASE_URL peker på godkjent thesis-Neon.
 *
 * Usage:
 *   bun run thesis-db:verify
 *   THESIS_DB_CONFIRM=1 bun run thesis-db:verify
 */

import "dotenv/config";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import pg from "pg";
import {
  assertThesisDatabaseUrl,
  getNormalizedDatabaseUrl,
  parseDatabaseUrl,
  THESIS_ALLOWED_DB_HOST,
  THESIS_ALLOWED_DB_NAME,
} from "../lib/config/thesis-db";

type Inventory = {
  buildings: number;
  organizations: number;
  integrations: number;
  infraspawnSources: number;
  meteringPoints: number;
};

async function loadInventory(client: pg.Client): Promise<Inventory> {
  const res = await client.query<Inventory>(`
    SELECT
      (SELECT count(*)::int FROM buildings) AS buildings,
      (SELECT count(*)::int FROM organizations) AS organizations,
      (SELECT count(*)::int FROM integrations) AS integrations,
      (SELECT count(*)::int FROM infraspawn_sources) AS "infraspawnSources",
      (SELECT count(*)::int FROM metering_points) AS "meteringPoints"
  `);
  return res.rows[0]!;
}

async function main() {
  assertThesisDatabaseUrl();

  const buildingSlug =
    resolveBuildingSlug();
  const confirm = process.env.THESIS_DB_CONFIRM === "1";

  const dbUrl = parseDatabaseUrl(process.env.DATABASE_URL, "DATABASE_URL");
  const directUrl = parseDatabaseUrl(process.env.DIRECT_URL, "DIRECT_URL");

  console.log("[thesis-db:verify] Godkjent database:");
  console.log(`  host:     ${THESIS_ALLOWED_DB_HOST}`);
  console.log(`  database: ${THESIS_ALLOWED_DB_NAME}`);
  if (dbUrl) {
    console.log(`  DATABASE_URL → ${dbUrl.host} / ${dbUrl.database}`);
  }
  if (directUrl) {
    console.log(`  DIRECT_URL → ${directUrl.host} / ${directUrl.database}`);
  }

  const client = new pg.Client({ connectionString: getNormalizedDatabaseUrl() });
  await client.connect();

  try {
    const live = await client.query<{ db: string; usr: string }>(
      "SELECT current_database() AS db, current_user AS usr",
    );
    console.log(
      `[thesis-db:verify] Tilkoblet: ${live.rows[0]!.db} (${live.rows[0]!.usr})`,
    );

    const inventory = await loadInventory(client);
    console.log("[thesis-db:verify] Inventory:", inventory);

    const caseRes = await client.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM buildings WHERE slug = $1 LIMIT 1`,
      [buildingSlug],
    );
    const caseBuilding = caseRes.rows[0];
    if (!caseBuilding) {
      console.error(
        `[thesis-db:verify] Case-bygg '${buildingSlug}' finnes ikke i DB.`,
      );
      process.exit(1);
    }
    console.log(
      `[thesis-db:verify] Case-bygg OK: ${caseBuilding.slug} (${caseBuilding.id})`,
    );

    const isSharedCopy = inventory.buildings > 1 || inventory.organizations > 1;
    if (isSharedCopy && !confirm) {
      console.error(
        "[thesis-db:verify] DB ser ut som full plattformkopi " +
          `(${inventory.buildings} bygg, ${inventory.organizations} org). ` +
          "Destruktive operasjoner krever THESIS_DB_CONFIRM=1.",
      );
      process.exit(1);
    }

    if (isSharedCopy && confirm) {
      console.warn(
        "[thesis-db:verify] THESIS_DB_CONFIRM=1 — destruktiv retain/drop tillatt.",
      );
    }

    console.log("[thesis-db:verify] OK");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[thesis-db:verify] FEIL:", error);
  process.exit(1);
});
