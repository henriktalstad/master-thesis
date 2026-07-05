import { mkdir, writeFile } from "node:fs/promises";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { resolve } from "node:path";

import { prisma } from "@/lib/db";
import { addUtcDays, utcDayMidnight } from "@/lib/energy-prices/day-utils";
import { getThesisEvalWindow } from "@/lib/config/thesis-eval";
import type { MpcPipelineRunRecord } from "@/lib/sd-anlegg/control/control-types";
import type { MpcEnergyReconcileSummary } from "@/lib/sd-anlegg/control/build-mpc-energy-reconcile";
import { loadLatestMpcEnergyReconcile } from "@/lib/sd-anlegg/control/load-mpc-energy-reconcile";
import { loadLatestMpcPipelineRunForExport } from "@/lib/sd-anlegg/control/load-mpc-pipeline-run";
import { normalizeReplaySummary } from "@/lib/sd-anlegg/control/build-control-strategy-comparison";
import type { MpcForwardPlan } from "@/lib/sd-anlegg/control/control-types";
import type { MpcReplayResult } from "@/lib/sd-anlegg/mpc/shared/types";

export type EnergyComparisonExport = {
  generatedAt: string;
  buildingSlug: string;
  evalStart: string | null;
  evalEnd: string | null;
  measured: {
    electricityKwh: number;
    districtHeatingKwh: number;
    totalCostKr: number;
    hours: number;
  };
  baseline: {
    totalKwh: number;
    totalCostKr: number;
  } | null;
  mpcReplay: {
    totalKwh: number;
    totalCostKr: number;
    deltaKwh: number;
    deltaCostKr: number;
    deltaPctKwh: number;
    deltaPctCostKr: number;
  } | null;
  forwardPlan: {
    horizonSteps: number;
    expectedDeltaCostKr: number | null;
    computedAt: string | null;
  } | null;
  mpcRunId: string | null;
  energyReconcile: {
    hoursAligned: number;
    measured: MpcEnergyReconcileSummary["measured"];
    proxy: MpcEnergyReconcileSummary["proxy"];
    deltaMpcVsEmulated: MpcEnergyReconcileSummary["deltaMpcVsEmulated"];
    shares: MpcEnergyReconcileSummary["shares"];
  } | null;
  outputPaths: string[];
};

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function replayTotals(summary: MpcReplayResult["summary"]) {
  const baselineKwh =
    summary.controllableElectricKwhBaseline + summary.controllableHeatKwhBaseline;
  const mpcKwh =
    summary.controllableElectricKwhMpc + summary.controllableHeatKwhMpc;
  return {
    totalKwh: mpcKwh,
    totalCostKr: summary.totalCostMpcKr,
    deltaKwh: mpcKwh - baselineKwh,
    deltaCostKr: summary.deltaCostKr,
    deltaPctKwh:
      baselineKwh > 0
        ? Math.round(((mpcKwh - baselineKwh) / baselineKwh) * 1000) / 10
        : 0,
    deltaPctCostKr: summary.deltaCostPct,
    baselineKwh,
    baselineCostKr: summary.totalCostBaselineKr,
  };
}

export async function exportEnergyComparison(input?: {
  outDir?: string;
  /** Canonical thesis run — avoids stale loadLatest when MPC_CANONICAL_PIPELINE_RUN_ID is set. */
  pipelineRun?: MpcPipelineRunRecord | null;
  energyReconcileSummary?: MpcEnergyReconcileSummary | null;
}): Promise<EnergyComparisonExport> {
  const slug = resolveBuildingSlug();

  const building = await prisma.building.findFirst({
    where: { slug },
    select: { id: true, slug: true },
  });
  if (!building) throw new Error(`Fant ikke bygg ${slug}`);

  const evalWin = getThesisEvalWindow();
  const start =
    evalWin.start ?? addUtcDays(utcDayMidnight(new Date()), -30);
  const end = addUtcDays(evalWin.end ?? utcDayMidnight(new Date()), 1);

  const bhccRows = await prisma.buildingHourlyCostCache.findMany({
    where: { buildingId: building.id, hour: { gte: start, lt: end } },
    orderBy: { hour: "asc" },
    select: {
      hour: true,
      electricityVolumeKwh: true,
      electricityTotalCost: true,
      districtHeatingVolumeKwh: true,
      districtHeatingTotalCost: true,
    },
  });

  const measured = bhccRows.reduce(
    (acc, row) => {
      const el = row.electricityVolumeKwh ?? 0;
      const dh = row.districtHeatingVolumeKwh ?? 0;
      if (el <= 0 && dh <= 0) return acc;
      acc.electricityKwh += el;
      acc.districtHeatingKwh += dh;
      acc.totalCostKr +=
        (row.electricityTotalCost ?? 0) + (row.districtHeatingTotalCost ?? 0);
      acc.hours += 1;
      return acc;
    },
    {
      electricityKwh: 0,
      districtHeatingKwh: 0,
      totalCostKr: 0,
      hours: 0,
    },
  );

  const canonicalRun =
    input?.pipelineRun ?? (await loadLatestMpcPipelineRunForExport(building.id));
  const replaySummary = canonicalRun?.snapshot.replaySummary ?? null;
  const replayTotals_ = replaySummary
    ? replayTotals(normalizeReplaySummary(replaySummary))
    : null;

  const energyReconcileSummary =
    input?.energyReconcileSummary ??
    (await loadLatestMpcEnergyReconcile(building.id))?.summary ??
    null;

  const liveState = await prisma.sdAnleggLiveMpcState.findUnique({
    where: { buildingId: building.id },
    select: { forwardPlan: true },
  });
  const mpcForwardPlan = liveState?.forwardPlan as MpcForwardPlan | null;

  const forwardPlan = mpcForwardPlan
    ? {
        horizonSteps: mpcForwardPlan.horizonSteps,
        expectedDeltaCostKr: mpcForwardPlan.effect?.deltaCostKr ?? null,
        computedAt: mpcForwardPlan.computedAt ?? null,
      }
    : null;

  const outDir =
    input?.outDir ?? resolve(process.cwd(), "../data/processed");
  await mkdir(outDir, { recursive: true });

  const summaryPath = resolve(outDir, "energy_comparison.json");
  const hourlyPath = resolve(outDir, "building_hourly_measured.csv");
  const planPath = resolve(outDir, "mpc_forward_plan.csv");

  const exportDoc: EnergyComparisonExport = {
    generatedAt: new Date().toISOString(),
    buildingSlug: slug,
    evalStart: evalWin.start?.toISOString().split("T")[0] ?? null,
    evalEnd: evalWin.end?.toISOString().split("T")[0] ?? null,
    measured,
    baseline: replayTotals_
      ? {
          totalKwh: replayTotals_.baselineKwh,
          totalCostKr: replayTotals_.baselineCostKr,
        }
      : null,
    mpcReplay: replayTotals_
      ? {
          totalKwh: replayTotals_.totalKwh,
          totalCostKr: replayTotals_.totalCostKr,
          deltaKwh: replayTotals_.deltaKwh,
          deltaCostKr: replayTotals_.deltaCostKr,
          deltaPctKwh: replayTotals_.deltaPctKwh,
          deltaPctCostKr: replayTotals_.deltaPctCostKr,
        }
      : null,
    forwardPlan,
    mpcRunId: canonicalRun?.id ?? null,
    energyReconcile: energyReconcileSummary
      ? {
          hoursAligned: energyReconcileSummary.hoursAligned,
          measured: energyReconcileSummary.measured,
          proxy: energyReconcileSummary.proxy,
          deltaMpcVsEmulated: energyReconcileSummary.deltaMpcVsEmulated,
          shares: energyReconcileSummary.shares,
        }
      : null,
    outputPaths: [summaryPath, hourlyPath, planPath],
  };

  await writeFile(summaryPath, `${JSON.stringify(exportDoc, null, 2)}\n`, "utf8");

  const hourlyCsv = [
    "hour_utc,electricity_kwh,district_heating_kwh,total_cost_kr",
    ...bhccRows
      .filter(
        (r) =>
          (r.electricityVolumeKwh ?? 0) > 0 ||
          (r.districtHeatingVolumeKwh ?? 0) > 0,
      )
      .map((r) =>
        [
          r.hour.toISOString(),
          r.electricityVolumeKwh ?? 0,
          r.districtHeatingVolumeKwh ?? 0,
          (r.electricityTotalCost ?? 0) + (r.districtHeatingTotalCost ?? 0),
        ]
          .map(csvEscape)
          .join(","),
      ),
  ].join("\n");
  await writeFile(hourlyPath, `${hourlyCsv}\n`, "utf8");

  const planCsv = mpcForwardPlan?.planSteps.length
    ? [
        "t_utc,spot_kr_per_kwh,marginal_kr_per_kwh,outdoor_temp_c,expected_delta_cost_kr",
        ...mpcForwardPlan.planSteps.map((step) =>
          [
            step.t,
            step.spotKrPerKwh ?? "",
            step.effectiveMarginalKrPerKwh ?? "",
            step.outdoorTempC ?? "",
            step.expectedDeltaCostKr ?? "",
          ]
            .map(csvEscape)
            .join(","),
        ),
      ].join("\n")
    : "t_utc,spot_kr_per_kwh,marginal_kr_per_kwh,outdoor_temp_c,expected_delta_cost_kr\n";
  await writeFile(planPath, `${planCsv}\n`, "utf8");

  return exportDoc;
}
