#!/usr/bin/env bun
/**
 * Audit kjøleventil: sammenlign pådrag (AO_5) vs feedback (AO_4).
 *
 * Usage:
 *   bun run scripts/audit-cooling-valve.ts
 */

import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { prisma } from "@/lib/db";
import { resolveCoolingValveFeedbackObjectId } from "@/lib/sd-anlegg/control/resolve-cooling-valve-pct";
import {
  COOLING_VALVE_SATURATED_COMMAND_PCT,
  resolveTrustedCoolingValvePct,
} from "@/lib/sd-anlegg/control/resolve-cooling-valve-pct";
import { getThesisEvalWindow } from "@/lib/config/thesis-eval";
import { controlHourKeyFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import { buildMpcTimeGrid, bucketSamplesByMpcStep } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import { getBuildingWeatherBinding } from "@/lib/weather/ensure-pinned-station";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";
import { listMpcPointMeta } from "@/services/mpc/mpc-point-meta";
import { CONTROL_SIGNAL_CATALOG_360102 } from "@/lib/sd-anlegg/control/control-signal-catalog";
import { resolvePointForCatalogEntry } from "@/lib/sd-anlegg/control/resolve-control-signals";

async function loadOutdoorByHour(
  buildingId: string,
  since: Date,
  until: Date,
): Promise<Map<string, number | null>> {
  const binding = await getBuildingWeatherBinding(buildingId);
  if (!binding?.stationId) return new Map();

  const series = await prisma.weatherSeries.findFirst({
    where: {
      stationId: binding.stationId,
      elementId: { in: ["air_temperature", "mean(air_temperature PT1H)"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!series) return new Map();

  const rows = await prisma.weatherObservation.findMany({
    where: {
      seriesId: series.id,
      referenceTime: { gte: since, lte: until },
    },
    select: { referenceTime: true, value: true },
  });

  const byHour = new Map<string, number | null>();
  for (const row of rows) {
    if (row.value == null) continue;
    byHour.set(
      controlHourKeyFromIso(row.referenceTime.toISOString()),
      Math.round(Number(row.value) * 10) / 10,
    );
  }
  return byHour;
}

async function main() {
  const ctx = await resolveMpcBuildingSource({});
  if (!ctx) {
    console.error("[audit-cooling-valve] BUILDING_SLUG/BUILDING_ID mangler");
    process.exit(1);
  }

  const thesisWindow = getThesisEvalWindow();
  const evalStart = thesisWindow.start ?? new Date(Date.now() - 14 * 86400000);
  const evalEnd = thesisWindow.end ?? new Date();

  const points = await listMpcPointMeta(ctx.sourceId);
  const cmdEntry = CONTROL_SIGNAL_CATALOG_360102.find(
    (e) => e.canonicalId === "cooling.valve.command",
  );
  const fbEntry = CONTROL_SIGNAL_CATALOG_360102.find(
    (e) => e.canonicalId === "cooling.valve.position",
  );
  const cmdPt = cmdEntry
    ? resolvePointForCatalogEntry(points, cmdEntry)
    : null;
  const fbObjectId = resolveCoolingValveFeedbackObjectId(points);
  const fbPt =
    fbEntry && fbObjectId
      ? { objectId: fbObjectId, objectName: fbEntry.influxPatterns[0] }
      : null;

  if (!cmdPt) {
    console.error("[audit-cooling-valve] fant ikke cooling.valve.command");
    process.exit(1);
  }

  const [cmdRows, fbRows, weatherByHour] = await Promise.all([
    prisma.infraspawnBacnetSample.findMany({
      where: {
        sourceId: ctx.sourceId,
        objectId: cmdPt.objectId,
        resolution: "15m",
        sampledAt: { gte: evalStart, lte: evalEnd },
      },
      orderBy: { sampledAt: "asc" },
      select: { sampledAt: true, valueNum: true, quality: true },
    }),
    fbPt
      ? prisma.infraspawnBacnetSample.findMany({
          where: {
            sourceId: ctx.sourceId,
            objectId: fbPt.objectId,
            resolution: "15m",
            sampledAt: { gte: evalStart, lte: evalEnd },
          },
          orderBy: { sampledAt: "asc" },
          select: { sampledAt: true, valueNum: true, quality: true },
        })
      : Promise.resolve([]),
    loadOutdoorByHour(ctx.buildingId, evalStart, evalEnd),
  ]);

  const cmdByT = bucketSamplesByMpcStep(
    cmdRows.map((r) => ({
      t: r.sampledAt.toISOString(),
      value: r.valueNum,
    })),
  );
  const fbByT = bucketSamplesByMpcStep(
    fbRows.map((r) => ({
      t: r.sampledAt.toISOString(),
      value: r.valueNum,
    })),
  );

  const grid = buildMpcTimeGrid(evalStart, evalEnd);
  const paired = grid.filter((t) => cmdByT.has(t));

  let saturated = 0;
  let saturatedLowFeedback = 0;
  let resolvedViaFeedback = 0;
  let resolvedToZero = 0;
  const examples: Array<Record<string, unknown>> = [];

  for (const t of paired) {
    const cmd = cmdByT.get(t) ?? 0;
    const fb = fbByT.get(t);
    const outdoorTempC = weatherByHour.get(controlHourKeyFromIso(t)) ?? null;
    const resolved = resolveTrustedCoolingValvePct({
      commandPct: cmd,
      feedbackPct: fb,
      outdoorTempC,
    });

    if (cmd >= COOLING_VALVE_SATURATED_COMMAND_PCT) {
      saturated += 1;
      if (fb != null && fb < 20) saturatedLowFeedback += 1;
      if (resolved.source === "feedback") resolvedViaFeedback += 1;
      if (resolved.trustedPct === 0) resolvedToZero += 1;
      if (examples.length < 8) {
        examples.push({
          t,
          cmd,
          fb: fb ?? null,
          outdoorTempC,
          trustedPct: resolved.trustedPct,
          source: resolved.source,
        });
      }
    }
  }

  let modulatedPairs = 0;
  let modulatedFbCmdSum = 0;
  for (const t of paired) {
    const cmd = cmdByT.get(t) ?? 0;
    const fb = fbByT.get(t);
    if (cmd > 8 && cmd < COOLING_VALVE_SATURATED_COMMAND_PCT && fb != null) {
      modulatedPairs += 1;
      modulatedFbCmdSum += fb / cmd;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    evalStart: evalStart.toISOString(),
    evalEnd: evalEnd.toISOString(),
    commandPoint: {
      objectId: cmdPt.objectId,
      objectName: cmdPt.objectName,
    },
    feedbackPoint: fbPt
      ? { objectId: fbPt.objectId, objectName: fbPt.objectName }
      : null,
    stepCount: paired.length,
    commandSamples: cmdRows.length,
    feedbackSamples: fbRows.length,
    saturatedCommandSteps: saturated,
    saturatedWithFeedbackBelow20Pct: saturatedLowFeedback,
    resolvedViaFeedback,
    resolvedToZero,
    modulatedSteps: modulatedPairs,
    modulatedFeedbackToCommandRatio:
      modulatedPairs > 0
        ? Math.round((modulatedFbCmdSum / modulatedPairs) * 1000) / 1000
        : null,
    modulatedScaleNote:
      "Under 99 % brukes rå AO_5; fb/cmd ≪ 1 tyder på ulik skala — valider mot energidata før feedback-styrt modulering.",
    interpretation:
      "Mettet AO_5 (≥99 %) uten fysisk åpen ventil — trust-resolve bruker feedback eller 0.",
    examples,
  };

  const outDir = resolve(process.cwd(), "../data/processed");
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, "cooling_valve_audit.json");
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`[audit-cooling-valve] ${outPath}`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
