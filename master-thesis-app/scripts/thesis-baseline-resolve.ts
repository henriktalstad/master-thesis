#!/usr/bin/env bun
/**
 * Marker thesis-baseline som applied på DB som allerede matcher schema.prisma.
 *
 * Usage:
 *   THESIS_DB_CONFIRM=1 bun run thesis-db:baseline-resolve
 */

import "dotenv/config";
import { spawnSync } from "node:child_process";
import pg from "pg";
import {
  assertThesisDatabaseUrl,
  getNormalizedDatabaseUrl,
} from "../lib/config/thesis-db";

const BASELINE_MIGRATION = "20260704_thesis_baseline";

async function main() {
  if (process.env.THESIS_DB_CONFIRM !== "1") {
    console.error("Krever THESIS_DB_CONFIRM=1");
    process.exit(1);
  }

  assertThesisDatabaseUrl();

  const diff = spawnSync(
    "bunx",
    [
      "--bun",
      "prisma",
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      "prisma/schema.prisma",
      "--exit-code",
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, PRISMA_ENV_QUIET: "1" },
      encoding: "utf8",
    },
  );

  if (diff.status !== 0) {
    console.error(
      "[thesis-db:baseline-resolve] DB matcher ikke schema.prisma — fiks drift først.",
    );
    if (diff.stdout) console.error(diff.stdout);
    if (diff.stderr) console.error(diff.stderr);
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: getNormalizedDatabaseUrl() });
  await client.connect();

  try {
    const before = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "_prisma_migrations"`,
    );
    console.log(
      `[thesis-db:baseline-resolve] Fjerner ${before.rows[0]!.n} migrasjonsrader…`,
    );
    await client.query(`DELETE FROM "_prisma_migrations"`);
  } finally {
    await client.end();
  }

  const resolve = spawnSync(
    "bunx",
    ["--bun", "prisma", "migrate", "resolve", "--applied", BASELINE_MIGRATION],
    {
      cwd: process.cwd(),
      env: { ...process.env, PRISMA_ENV_QUIET: "1" },
      encoding: "utf8",
      stdio: "inherit",
    },
  );

  if (resolve.status !== 0) {
    process.exit(resolve.status ?? 1);
  }

  console.log("[thesis-db:baseline-resolve] OK — kun baseline registrert");
}

main().catch((error) => {
  console.error("[thesis-db:baseline-resolve] FEIL:", error);
  process.exit(1);
});
