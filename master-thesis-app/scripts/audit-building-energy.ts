#!/usr/bin/env bun
/**
 * Sammenligner byggnivå energi (BHCC/målerpunkter) med MPC power-proxy.
 * Skriver data/processed/building_energy_audit.json
 */

import "dotenv/config";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getThesisEvalWindow } from "@/lib/config/thesis-eval";
import { resolveEffectiveEvalWindowForMpc } from "@/services/mpc/resolve-effective-eval-window";
import { fitPowerProxyParams } from "@/lib/sd-anlegg/mpc/controller/envelope-model/build-power-proxies";
import {
  estimateControllableElectricKw,
  estimateControllableHeatKw,
} from "@/lib/sd-anlegg/mpc/controller/envelope-model/build-power-proxies";
import { fitMpcCalibrationFromSteps } from "@/lib/sd-anlegg/mpc/pipeline/run-mpc-pipeline";
import { MPC_STEP_MINUTES } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import { loadEvalDatasetForMpc } from "@/services/mpc/load-eval-dataset";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";
import { resolveEnergyGroundTruth } from "@/lib/eval/resolve-energy-ground-truth";

const OUTPUT = path.join(
  process.cwd(),
  "../data/processed/building_energy_audit.json",
);

async function main() {
  const ctx = await resolveMpcBuildingSource({
    buildingSlug: resolveBuildingSlug(),
  });
  if (!ctx) {
    console.error(`[audit-energy] Fant ikke bygg «${resolveBuildingSlug()}» i DB`);
    process.exit(1);
  }

  const thesisWindow = getThesisEvalWindow();
  const resolved = await resolveEffectiveEvalWindowForMpc({
    configuredStart: thesisWindow.start ?? undefined,
    configuredEnd: thesisWindow.end ?? undefined,
    buildingSlug: ctx.buildingSlug,
  });
  const evalStart = resolved.evalStart;
  const evalEnd = resolved.evalEnd;
  console.log(`[audit-energy] vindu ${evalStart.toISOString().slice(0, 10)} – ${evalEnd.toISOString().slice(0, 10)} (${resolved.stepCount ?? "?"} steg)`);

  const dataset = await loadEvalDatasetForMpc({
    buildingSlug: ctx.buildingSlug,
    evalStart,
    evalEnd,
  });
  if (!dataset?.steps.length) {
    console.error("[audit-energy] ingen dataset-steg");
    process.exit(1);
  }

  const bhcc = await prisma.buildingHourlyCostCache.findMany({
    where: {
      buildingId: ctx.buildingId,
      hour: { gte: evalStart, lte: evalEnd },
    },
    select: {
      electricityVolumeKwh: true,
      electricityTotalCost: true,
      electricitySpotCost: true,
      electricityGridEnergyCost: true,
      districtHeatingVolumeKwh: true,
      districtHeatingTotalCost: true,
      districtHeatingEffectCost: true,
    },
  });

  const stepHours = MPC_STEP_MINUTES / 60;
  let buildingElKwh = 0;
  let buildingHeatKwh = 0;
  let controllableElKwh = 0;
  let controllableHeatKwh = 0;
  let peakBuildingKw = 0;
  let peakControllableKw = 0;

  const calibration = fitMpcCalibrationFromSteps(dataset.steps);
  const power = calibration?.power ?? fitPowerProxyParams(dataset.steps);

  for (const step of dataset.steps) {
    if (!step.uMeas) continue;
    buildingElKwh += step.buildingElectricityKwh;
    buildingHeatKwh += step.buildingDistrictHeatingKwh;
    const buildingKw = step.buildingElectricityKwh / stepHours;
    peakBuildingKw = Math.max(peakBuildingKw, buildingKw);

    const ctrlEl = estimateControllableElectricKw({
      u: step.uMeas,
      buildingElectricityKwh: step.buildingElectricityKwh,
      params: power,
    });
    const ctrlHeat = estimateControllableHeatKw({
      u: step.uMeas,
      outdoorTempC: step.outdoorTempC,
      buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh,
      params: power,
    });
    controllableElKwh += ctrlEl * stepHours;
    controllableHeatKwh += ctrlHeat * stepHours;
    peakControllableKw = Math.max(peakControllableKw, ctrlEl);
  }

  const bhccElKwh = bhcc.reduce(
    (a, r) => a + (r.electricityVolumeKwh ?? 0),
    0,
  );
  const bhccHeatKwh = bhcc.reduce(
    (a, r) => a + (r.districtHeatingVolumeKwh ?? 0),
    0,
  );
  const bhccElCost = bhcc.reduce(
    (a, r) => a + (r.electricityTotalCost ?? 0),
    0,
  );
  const bhccHeatCost = bhcc.reduce(
    (a, r) => a + (r.districtHeatingTotalCost ?? 0),
    0,
  );
  const bhccDhEffectCost = bhcc.reduce(
    (a, r) => a + (r.districtHeatingEffectCost ?? 0),
    0,
  );

  const circuitMeter = await loadCircuitDistrictHeatingValidation({
    evalStart: dataset.evalStart,
    evalEnd: dataset.evalEnd,
  });

  const groundTruth = await resolveEnergyGroundTruth({
    buildingId: ctx.buildingId,
    evalStart,
    evalEnd,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    evalStart: dataset.evalStart,
    evalEnd: dataset.evalEnd,
    stepCount: dataset.steps.length,
    buildingLevel: {
      electricityKwhFromSteps: Math.round(buildingElKwh * 10) / 10,
      electricityKwhFromBhcc: Math.round(bhccElKwh * 10) / 10,
      districtHeatingKwhFromSteps: Math.round(buildingHeatKwh * 10) / 10,
      districtHeatingKwhFromBhcc: Math.round(bhccHeatKwh * 10) / 10,
      electricityTotalCostKrBhcc: Math.round(bhccElCost * 100) / 100,
      districtHeatingTotalCostKrBhcc: Math.round(bhccHeatCost * 100) / 100,
      districtHeatingEffectCostKrBhcc: Math.round(bhccDhEffectCost * 100) / 100,
      peakHourlyElectricKwFromSteps: Math.round(peakBuildingKw * 10) / 10,
    },
    controllableProxy: {
      controllableElectricKwh: Math.round(controllableElKwh * 10) / 10,
      controllableHeatKwh: Math.round(controllableHeatKwh * 10) / 10,
      controllableElectricShareOfBuilding:
        buildingElKwh > 0
          ? Math.round((controllableElKwh / buildingElKwh) * 1000) / 10
          : null,
      controllableHeatShareOfBuilding:
        buildingHeatKwh > 0
          ? Math.round((controllableHeatKwh / buildingHeatKwh) * 1000) / 10
          : null,
      configuredElectricShare: power.controllableElectricShare,
      configuredHeatShare: power.controllableHeatShare,
      peakControllableElectricKw: Math.round(peakControllableKw * 10) / 10,
    },
    circuitMeterValidation: circuitMeter,
    groundTruth,
    limitations: [
      "15-min steps use hourly BHCC kWh / 4 — correct for energy, not for sub-hourly peak.",
      "Controllable electric kW uses fan/coil proxy + building share — no AHU electrical submeter in Infraspawn.",
      "Controllable heat kW uses valve/outdoor proxy + building share — not isolated to AHU coil despite 320003OE001 circuit meter.",
      "320003OE001 validates næring FV kWh against BHCC (~5 % gap) but does not correlate with AHU heating valve (|r| < 0.06) — unsuitable as MPC controllable heat input.",
      "MPC marginal price uses spot + grid energy addon; electricity effect/demand charge not in objective.",
      "districtHeatingEffectCost in BHCC is not allocated to MPC heatKrPerKwh (volume-average only).",
      "Cooling from BHCC (coolingVolumeKwh) is not mapped to AHU cooling coil in mpc-v1.",
      `Measured ground truth: BHCC/Kost (${groundTruth.measured.electricityKwh} kWh el / ${groundTruth.measured.districtHeatingKwh} kWh FV, ${groundTruth.hourlyCoveragePct} % time-dekning).`,
      ...(groundTruth.csvOverlay
        ? [
            `Valgfri data/eval overlay (${groundTruth.csvOverlay.manifest.files.join(", ")}) — el Δ ${groundTruth.csvOverlay.vsBhcc?.electricityDeltaPct ?? "—"} % vs BHCC.`,
          ]
        : []),
    ],
  };

  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.info("[audit-energy] bygg el kWh (steg/BHCC):", report.buildingLevel);
  console.info("[audit-energy] kontrollerbar proxy:", report.controllableProxy);
  if (circuitMeter) {
    console.info("[audit-energy] kretssnitt FV:", circuitMeter);
  }
  console.info(`[audit-energy] skrev ${OUTPUT}`);
}

async function loadCircuitDistrictHeatingValidation(input: {
  evalStart: string;
  evalEnd: string;
}) {
  const start = new Date(input.evalStart);
  const end = new Date(input.evalEnd);

  const samples = await prisma.infraspawnBacnetSample.findMany({
    where: {
      resolution: "15m",
      sampledAt: { gte: start, lt: end },
      objectId: { in: ["AI-12", "AI-14", "AV-40372"] },
    },
    select: { objectId: true, sampledAt: true, valueNum: true },
    orderBy: { sampledAt: "asc" },
  });

  const energi = samples.filter((s) => s.objectId === "AI-12");
  if (energi.length < 2) return null;

  const deltaKwh =
    (energi.at(-1)?.valueNum ?? 0) - (energi[0]?.valueNum ?? 0);

  const eff = samples.filter((s) => s.objectId === "AI-14");
  const valve = samples.filter((s) => s.objectId === "AV-40372");
  const valveByTime = new Map(
    valve.map((s) => [s.sampledAt.getTime(), s.valueNum ?? 0]),
  );
  const xs: number[] = [];
  const ys: number[] = [];
  for (const row of eff) {
    const y = valveByTime.get(row.sampledAt.getTime());
    if (y == null) continue;
    xs.push(row.valueNum ?? 0);
    ys.push(y);
  }

  let pearsonHeatingValve: number | null = null;
  const n = xs.length;
  if (n > 2) {
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < n; i++) {
      const a = xs[i]! - mx;
      const b = ys[i]! - my;
      num += a * b;
      dx += a * a;
      dy += b * b;
    }
    pearsonHeatingValve = dx * dy === 0 ? null : num / Math.sqrt(dx * dy);
  }

  return {
    objectId: "AI-12",
    objectName: "320003OE001_energi",
    role: "Fjernvarmemåler næring (kretssnitt 320.003)",
    deltaKwh: Math.round(deltaKwh * 10) / 10,
    sampleCount: energi.length,
    pearsonVsAhuHeatingValve: pearsonHeatingValve,
    alignedStepsWithValve: n,
    suitableForMpcControllableHeat:
      pearsonHeatingValve != null && Math.abs(pearsonHeatingValve) >= 0.25,
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
