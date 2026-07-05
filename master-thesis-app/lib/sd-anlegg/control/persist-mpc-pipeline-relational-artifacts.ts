import "server-only";

import type { MpcChartSeries, MpcPriceLoadBand } from "@/generated/client";
import { prisma } from "@/lib/db";
import type { PriceBand } from "@/lib/sd-anlegg/mpc/forecasts/price-thresholds";
import type { PolicySummaryKpi } from "@/lib/sd-anlegg/mpc/controller/policies/types";
import { policyNomenclature } from "@/lib/sd-anlegg/control/control-nomenclature";
import type { MpcPipelineResult, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { buildMpcPipelineUiArtifacts } from "./persist-mpc-ui-artifacts";
import { toPrismaJson } from "./prisma-json";
import type { PriceLoadShiftAnalysis } from "./build-price-load-shift-analysis";
import type { MpcEvalChartBundle } from "./load-mpc-eval-artifacts";

const CHART_CHUNK = 400;

function priceBandToEnum(band: PriceBand): MpcPriceLoadBand {
  switch (band) {
    case "low":
      return "LOW";
    case "high":
      return "HIGH";
    default:
      return "MID";
  }
}

function enumToPriceBand(band: MpcPriceLoadBand): PriceBand {
  switch (band) {
    case "LOW":
      return "low";
    case "HIGH":
      return "high";
    default:
      return "medium";
  }
}

function pctDelta(next: number, base: number): number {
  if (base === 0) return 0;
  return Math.round(((next - base) / base) * 1000) / 10;
}

export async function replacePolicyKpis(input: {
  pipelineRunId: string;
  policies: readonly PolicySummaryKpi[];
}): Promise<number> {
  await prisma.sdAnleggMpcPolicyKpi.deleteMany({
    where: { pipelineRunId: input.pipelineRunId },
  });
  if (input.policies.length === 0) return 0;

  const emulatedCost =
    input.policies.find((p) => p.policyId === "emulated")?.totalCostKr ?? 0;

  await prisma.sdAnleggMpcPolicyKpi.createMany({
    data: input.policies.map((p) => ({
      pipelineRunId: input.pipelineRunId,
      policyId: p.policyId,
      label: p.label,
      claimLevel: p.claimLevel,
      totalCostKr: p.totalCostKr,
      deltaCostVsObservedKr: p.deltaCostVsObservedKr,
      deltaCostVsObservedPct: p.deltaCostVsObservedPct,
      deltaCostVsEmulatedKr:
        Math.round((p.totalCostKr - emulatedCost) * 100) / 100,
      deltaCostVsEmulatedPct: pctDelta(p.totalCostKr, emulatedCost),
      comfortViolations: p.comfortViolations,
      peakElectricKw: p.peakElectricKw,
      controllableElectricKwh: p.controllableElectricKwh,
      controllableHeatKwh: p.controllableHeatKwh,
      fallbackSteps: 0,
    })),
  });
  return input.policies.length;
}

function chartPointsFromBundle(
  pipelineRunId: string,
  bundle: MpcEvalChartBundle,
  evalStart: string,
): Array<{
  pipelineRunId: string;
  series: MpcChartSeries;
  bucketAt: Date;
  baselineKr?: number | null;
  mpcKr?: number | null;
  deltaKr?: number | null;
  extractMeasC?: number | null;
  extractPredC?: number | null;
  extractPredEmulatedC?: number | null;
  extractPredDemandC?: number | null;
  bandMinC?: number | null;
  bandMaxC?: number | null;
  baselineKw?: number | null;
  mpcKw?: number | null;
  emulatedKw?: number | null;
  spotKrPerKwh?: number | null;
  comfortViolationMpc?: boolean | null;
}> {
  const rows: ReturnType<typeof chartPointsFromBundle> = [];

  for (const point of bundle.costTimeline) {
    rows.push({
      pipelineRunId,
      series: "COST_TIMELINE",
      bucketAt: new Date(point.hour),
      baselineKr: point.baselineCostKr,
      mpcKr: point.mpcCostKr,
      deltaKr: point.deltaCostKr,
    });
  }

  for (const point of bundle.comfort) {
    rows.push({
      pipelineRunId,
      series: "COMFORT",
      bucketAt: new Date(point.t),
      extractMeasC: point.measuredC,
      extractPredC: point.mpcC,
      extractPredEmulatedC: point.emulatedC,
      extractPredDemandC: point.demandC,
      bandMinC: point.comfortBandMinC,
      bandMaxC: point.comfortBandMaxC,
      comfortViolationMpc: point.comfortViolationMpc,
    });
  }

  for (const point of bundle.loadProfile) {
    rows.push({
      pipelineRunId,
      series: "LOAD_PROFILE",
      bucketAt: new Date(point.hour),
      baselineKw: point.peakObservedKw ?? point.observedKw,
      emulatedKw: point.peakEmulatedKw ?? point.actualKw,
      mpcKw: point.peakMpcKw ?? point.simulatedKw,
      spotKrPerKwh: point.spotKrPerKwh,
    });
  }

  if (bundle.effectSummary) {
    const effect = bundle.effectSummary;
    rows.push({
      pipelineRunId,
      series: "EFFECT_SUMMARY",
      bucketAt: new Date(evalStart),
      baselineKr: effect.baselineCostKr,
      mpcKr: effect.mpcCostKr,
      deltaKr: effect.deltaCostKr,
      baselineKw: effect.peakBaselineKw,
      mpcKw: effect.peakMpcKw,
    });
  }

  return rows;
}

export async function replaceChartPoints(input: {
  pipelineRunId: string;
  bundle: MpcEvalChartBundle;
  evalStart: string;
}): Promise<number> {
  await prisma.sdAnleggMpcPipelineChartPoint.deleteMany({
    where: { pipelineRunId: input.pipelineRunId },
  });
  const rows = chartPointsFromBundle(
    input.pipelineRunId,
    input.bundle,
    input.evalStart,
  );
  if (rows.length === 0) return 0;

  for (let i = 0; i < rows.length; i += CHART_CHUNK) {
    await prisma.sdAnleggMpcPipelineChartPoint.createMany({
      data: rows.slice(i, i + CHART_CHUNK),
    });
  }
  return rows.length;
}

export async function replacePriceLoadShiftBands(input: {
  pipelineRunId: string;
  analysis: PriceLoadShiftAnalysis;
}): Promise<number> {
  await prisma.sdAnleggMpcPriceLoadShiftBand.deleteMany({
    where: { pipelineRunId: input.pipelineRunId },
  });

  const entries = Object.entries(input.analysis.bands) as Array<
    [PriceBand, PriceLoadShiftAnalysis["bands"][PriceBand]]
  >;

  await prisma.sdAnleggMpcPriceLoadShiftBand.createMany({
    data: entries.map(([band, stats]) => ({
      pipelineRunId: input.pipelineRunId,
      band: priceBandToEnum(band),
      baselineKwh: stats.baselineKwh,
      mpcKwh: stats.mpcKwh,
      deltaKwh: stats.deltaKwh,
      deltaPct: stats.deltaPct,
    })),
  });
  return entries.length;
}

export async function persistRelationalPipelineArtifacts(input: {
  pipelineRunId: string;
  result: MpcPipelineResult;
  steps: readonly MpcReplayStep[];
}): Promise<{
  policyKpiCount: number;
  chartPointCount: number;
  priceLoadBandCount: number;
}> {
  const uiArtifacts = buildMpcPipelineUiArtifacts({
    result: input.result,
    steps: input.steps,
  });
  const policies = input.result.replay.summary.policySummaries ?? [];

  const [policyKpiCount, chartPointCount, priceLoadBandCount] =
    await Promise.all([
      replacePolicyKpis({ pipelineRunId: input.pipelineRunId, policies }),
      replaceChartPoints({
        pipelineRunId: input.pipelineRunId,
        bundle: uiArtifacts.chartBundle,
        evalStart: input.result.evalStart,
      }),
      replacePriceLoadShiftBands({
        pipelineRunId: input.pipelineRunId,
        analysis: uiArtifacts.priceLoadShift,
      }),
    ]);

  await prisma.sdAnleggMpcPipelineRun.update({
    where: { id: input.pipelineRunId },
    data: {
      chartsGeneratedAt: new Date(),
      uiArtifacts: toPrismaJson(uiArtifacts),
    },
  });

  return { policyKpiCount, chartPointCount, priceLoadBandCount };
}

export async function loadPolicyKpisForRun(
  pipelineRunId: string,
): Promise<PolicySummaryKpi[]> {
  const rows = await prisma.sdAnleggMpcPolicyKpi.findMany({
    where: { pipelineRunId },
    orderBy: { policyId: "asc" },
  });
  return rows.map((row) => {
    const policyId = row.policyId as PolicySummaryKpi["policyId"];
    const meta = policyNomenclature(policyId);
    return {
      policyId,
      label: meta.shortLabel,
      thesisLabel: meta.thesisLabel,
      controlMode: meta.controlMode,
      controlModeLabel: meta.controlModeLabel,
      role: meta.role,
      claimLevel: row.claimLevel as PolicySummaryKpi["claimLevel"],
      totalCostKr: row.totalCostKr,
      deltaCostVsObservedKr: row.deltaCostVsObservedKr,
      deltaCostVsObservedPct: row.deltaCostVsObservedPct,
      comfortViolations: row.comfortViolations,
      peakElectricKw: row.peakElectricKw,
      controllableElectricKwh: row.controllableElectricKwh,
      controllableHeatKwh: row.controllableHeatKwh,
    };
  });
}

export async function loadPriceLoadShiftForRun(
  pipelineRunId: string,
): Promise<PriceLoadShiftAnalysis | null> {
  const rows = await prisma.sdAnleggMpcPriceLoadShiftBand.findMany({
    where: { pipelineRunId },
  });
  if (rows.length === 0) return null;

  const bands = {
    high: { baselineKwh: 0, mpcKwh: 0, deltaKwh: 0, deltaPct: null as number | null },
    medium: { baselineKwh: 0, mpcKwh: 0, deltaKwh: 0, deltaPct: null as number | null },
    low: { baselineKwh: 0, mpcKwh: 0, deltaKwh: 0, deltaPct: null as number | null },
  };

  for (const row of rows) {
    const key = enumToPriceBand(row.band);
    bands[key] = {
      baselineKwh: row.baselineKwh,
      mpcKwh: row.mpcKwh,
      deltaKwh: row.deltaKwh,
      deltaPct: row.deltaPct,
    };
  }

  const high = bands.high;
  return {
    highPriceHours: 0,
    bands,
    deltaE_hp_kwh: high.deltaKwh,
    deltaE_hp_pct: high.deltaPct,
    highPriceCostBaselineKr: 0,
    highPriceCostMpcKr: 0,
    highPriceCostDeltaKr: 0,
    highPriceCostDeltaPct: null,
    interpretation: "",
  };
}

export async function loadChartBundleForRun(
  pipelineRunId: string,
): Promise<MpcEvalChartBundle | null> {
  const rows = await prisma.sdAnleggMpcPipelineChartPoint.findMany({
    where: { pipelineRunId },
    orderBy: [{ series: "asc" }, { bucketAt: "asc" }],
  });
  if (rows.length === 0) return null;

  const costTimeline = rows
    .filter((r) => r.series === "COST_TIMELINE")
    .map((r) => ({
      hour: r.bucketAt.toISOString(),
      baselineCostKr: r.baselineKr ?? 0,
      mpcCostKr: r.mpcKr ?? 0,
      deltaCostKr: r.deltaKr ?? 0,
    }));

  const comfort = rows
    .filter((r) => r.series === "COMFORT")
    .map((r) => ({
      t: r.bucketAt.toISOString(),
      measuredC: r.extractMeasC,
      emulatedC: r.extractPredEmulatedC ?? null,
      mpcC: r.extractPredC,
      demandC: r.extractPredDemandC ?? null,
      comfortBandMinC: r.bandMinC ?? 18,
      comfortBandMaxC: r.bandMaxC ?? 24,
      comfortViolationMpc: r.comfortViolationMpc ?? false,
      comfortViolationEmulated: false,
      comfortViolationDemand: false,
    }));

  const loadProfile = rows
    .filter((r) => r.series === "LOAD_PROFILE")
    .map((r) => ({
      hour: r.bucketAt.toISOString(),
      observedKw: r.baselineKw,
      actualKw: r.emulatedKw,
      simulatedKw: r.mpcKw,
      peakObservedKw: r.baselineKw,
      peakEmulatedKw: r.emulatedKw,
      peakMpcKw: r.mpcKw,
      costKr: 0,
      spotKrPerKwh: r.spotKrPerKwh ?? null,
    }));

  const effectRow = rows.find((r) => r.series === "EFFECT_SUMMARY");
  const effectSummary = effectRow
    ? {
        baselineCostKr: effectRow.baselineKr ?? 0,
        mpcCostKr: effectRow.mpcKr ?? 0,
        deltaCostKr: effectRow.deltaKr ?? 0,
        deltaCostPct: 0,
        baselineKwh: 0,
        mpcKwh: 0,
        peakBaselineKw: effectRow.baselineKw ?? 0,
        peakMpcKw: effectRow.mpcKw ?? 0,
      }
    : null;

  return {
    costTimeline,
    comfort,
    loadProfile,
    effectSummary,
    hourTable: [],
  };
}
