#!/usr/bin/env bun
/**
 * Bootstrap data/eval/ fra BHCC time-cache (utvikling / avstemming).
 * Skriver electricity_hourly.csv, district_heating_hourly.csv og manifest.json.
 *
 * Usage:
 *   bun run bootstrap-eval-from-bhcc
 */

import "dotenv/config";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "@/lib/db";
import { getThesisEvalWindow } from "@/lib/config/thesis-eval";
import { resolveEvalGroundTruthDir } from "@/lib/eval/load-eval-ground-truth";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";

function csvEscape(value: string | number): string {
  const text = String(value);
  if (text.includes(",") || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function main() {
  const ctx = await resolveMpcBuildingSource({
    buildingSlug: resolveBuildingSlug(),
  });
  if (!ctx) {
    console.error(`[bootstrap-eval] Fant ikke bygg «${resolveBuildingSlug()}» i DB`);
    process.exit(1);
  }

  const thesisWindow = getThesisEvalWindow();
  const evalStart =
    thesisWindow.start ?? new Date("2026-06-24T00:00:00.000Z");
  const evalEnd = thesisWindow.end ?? new Date("2026-07-03T00:00:00.000Z");

  const rows = await prisma.buildingHourlyCostCache.findMany({
    where: {
      buildingId: ctx.buildingId,
      hour: { gte: evalStart, lt: evalEnd },
    },
    orderBy: { hour: "asc" },
    select: {
      hour: true,
      electricityVolumeKwh: true,
      districtHeatingVolumeKwh: true,
    },
  });

  if (rows.length === 0) {
    console.error("[bootstrap-eval] ingen BHCC-rader i eval-vinduet");
    process.exit(1);
  }

  const outDir = resolveEvalGroundTruthDir();
  mkdirSync(outDir, { recursive: true });

  const elLines = ["timestamp_utc,electricity_kwh,source"];
  const dhLines = ["timestamp_utc,heat_kwh,source"];
  for (const row of rows) {
    const ts = row.hour.toISOString();
    elLines.push(
      [csvEscape(ts), row.electricityVolumeKwh ?? 0, "BHCC"].join(","),
    );
    dhLines.push(
      [csvEscape(ts), row.districtHeatingVolumeKwh ?? 0, "BHCC"].join(","),
    );
  }

  writeFileSync(resolve(outDir, "electricity_hourly.csv"), `${elLines.join("\n")}\n`);
  writeFileSync(resolve(outDir, "district_heating_hourly.csv"), `${dhLines.join("\n")}\n`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    evalStart: evalStart.toISOString(),
    evalEnd: evalEnd.toISOString(),
    buildingSlug: ctx.buildingSlug,
    files: ["electricity_hourly.csv", "district_heating_hourly.csv"],
    notes: "Bootstrap fra BHCC buildingHourlyCostCache — erstatt med faktura/elhub når tilgjengelig.",
  };
  writeFileSync(
    resolve(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  console.info(`[bootstrap-eval] skrev ${rows.length} timer til ${outDir}`);
  console.info("[bootstrap-eval] kjør: bun run validate-eval-ground-truth");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
