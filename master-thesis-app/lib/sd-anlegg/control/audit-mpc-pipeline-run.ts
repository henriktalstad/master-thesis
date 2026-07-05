import "server-only";

import { prisma } from "@/lib/db";
import { buildCapacityTariffAnalysis } from "./build-capacity-tariff-analysis";
import { buildMpcReplayLoadProfile } from "./build-mpc-replay-profiles";
import type { MpcEnergyReconcileSummary } from "./build-mpc-energy-reconcile";
import {
  evaluateMpcPipelineDbConsistency,
  type MpcPipelineDbAudit,
} from "./evaluate-mpc-pipeline-db-consistency";
import { loadGridTariffMonthlyBundle } from "./load-grid-tariff-monthly";
import {
  countPipelineReplaySteps,
  loadPipelineReplaySteps,
} from "./persist-mpc-pipeline-replay-steps";
import { loadPriceLoadShiftForRun } from "./persist-mpc-pipeline-relational-artifacts";

export type {
  MpcPipelineDbAudit,
  MpcPipelineDbCheck,
  MpcPipelineDbCheckStatus,
} from "./evaluate-mpc-pipeline-db-consistency";
export { evaluateMpcPipelineDbConsistency } from "./evaluate-mpc-pipeline-db-consistency";
export type { ReplayScalarVerification } from "./verify-replay-run-scalars";
export { verifyReplayRunScalars } from "./verify-replay-run-scalars";

function reconcileSummaryFromRun(run: {
  evalStart: Date;
  evalEnd: Date;
  measuredElectricityKwh: number | null;
  measuredDistrictHeatingKwh: number | null;
  measuredTotalCostKr: number | null;
  proxyEmulatedCostKr: number | null;
  proxyMpcCostKr: number | null;
  controllableElectricKwhEmulated: number | null;
  controllableHeatKwhEmulated: number | null;
  deltaMpcVsEmulatedCostKr: number | null;
  deltaMpcVsEmulatedCostPct: number | null;
}): MpcEnergyReconcileSummary | null {
  if (run.measuredElectricityKwh == null) return null;
  return {
    evalStart: run.evalStart.toISOString(),
    evalEnd: run.evalEnd.toISOString(),
    hoursAligned: 0,
    measured: {
      electricityKwh: run.measuredElectricityKwh,
      districtHeatingKwh: run.measuredDistrictHeatingKwh ?? 0,
      totalCostKr: run.measuredTotalCostKr ?? 0,
      hours: 0,
    },
    proxy: {
      observed: {
        elKwh: 0,
        heatKwh: 0,
        costKr: 0,
      },
      emulated: {
        elKwh: run.controllableElectricKwhEmulated ?? 0,
        heatKwh: run.controllableHeatKwhEmulated ?? 0,
        costKr: run.proxyEmulatedCostKr ?? 0,
      },
      mpc: {
        elKwh: 0,
        heatKwh: 0,
        costKr: run.proxyMpcCostKr ?? 0,
      },
    },
    shares: {
      controllableElectricShare: 0,
      controllableHeatShare: 0,
      proxyElectricShareOfMeasured: null,
      proxyHeatShareOfMeasured: null,
      proxyHeatShareOfCircuit: null,
      heatGroundTruth: "none",
    },
    deltaMpcVsEmulated: {
      costKr: run.deltaMpcVsEmulatedCostKr ?? 0,
      costPct: run.deltaMpcVsEmulatedCostPct ?? 0,
      elKwh: 0,
      heatKwh: 0,
    },
    heatingDemand: {
      activeSteps: 0,
      activeStepPct: 0,
      observed: { totalKwh: 0, batteryKwh: 0, districtKwh: 0 },
      emulated: { totalKwh: 0, batteryKwh: 0, districtKwh: 0 },
      mpc: { totalKwh: 0, batteryKwh: 0, districtKwh: 0 },
      demand: { totalKwh: 0, batteryKwh: 0, districtKwh: 0 },
      tr003: {
        fromPowerIntegralKwh: 0,
        fromEnergyMeterKwh: 0,
        groundTruthKwh: 0,
        source: "none",
      },
    },
    districtDeltaT: [],
  };
}

export async function auditMpcPipelineRun(
  pipelineRunId: string,
): Promise<MpcPipelineDbAudit | null> {
  const run = await prisma.sdAnleggMpcPipelineRun.findUnique({
    where: { id: pipelineRunId },
    select: {
      id: true,
      buildingId: true,
      evalStart: true,
      evalEnd: true,
      stepCount: true,
      deltaCostPct: true,
      meaningfulDeltaPct: true,
      fallbackSteps: true,
      totalCostBaselineKr: true,
      totalCostEmulatedKr: true,
      totalCostMpcKr: true,
      totalCostDemandKr: true,
      deltaCostKr: true,
      deltaCostVsEmulatedKr: true,
      deltaCostVsEmulatedPct: true,
      peakElectricKwBaseline: true,
      peakElectricKwEmulated: true,
      peakElectricKwMpc: true,
      controllableElectricKwhBaseline: true,
      controllableElectricKwhEmulated: true,
      controllableElectricKwhMpc: true,
      controllableHeatKwhBaseline: true,
      controllableHeatKwhEmulated: true,
      controllableHeatKwhMpc: true,
      comfortViolationsMpc: true,
      comfortViolationsBaseline: true,
      comfortViolationsEmulated: true,
      comfortViolationsDemand: true,
      measuredElectricityKwh: true,
      measuredDistrictHeatingKwh: true,
      measuredTotalCostKr: true,
      proxyEmulatedCostKr: true,
      proxyMpcCostKr: true,
      deltaMpcVsEmulatedCostKr: true,
      deltaMpcVsEmulatedCostPct: true,
      chartsGeneratedAt: true,
      _count: {
        select: {
          policyKpis: true,
          priceLoadShiftBands: true,
          chartPoints: true,
        },
      },
    },
  });
  if (!run) return null;

  const [
    replayStepRows,
    supervisoryCommands,
    energyReconcileHours,
    bhccHours,
    steps,
    tariffBundle,
    priceLoadShift,
  ] = await Promise.all([
    countPipelineReplaySteps(pipelineRunId),
    prisma.sdAnleggSupervisoryCommand.count({
      where: { pipelineRunId, kind: "replay_step" },
    }),
    prisma.sdAnleggMpcEnergyReconcileHour.count({
      where: { pipelineRunId },
    }),
    prisma.buildingHourlyCostCache.count({
      where: {
        buildingId: run.buildingId,
        hour: { gte: run.evalStart, lt: run.evalEnd },
      },
    }),
    loadPipelineReplaySteps({ pipelineRunId }),
    loadGridTariffMonthlyBundle({
      buildingId: run.buildingId,
      since: run.evalStart,
      until: run.evalEnd,
    }),
    loadPriceLoadShiftForRun(pipelineRunId),
  ]);

  const loadProfile = buildMpcReplayLoadProfile(steps);
  const capacityTariff = loadProfile.length
    ? buildCapacityTariffAnalysis({
        loadProfile,
        monthlyTariffs: tariffBundle.byMonth,
        bhccByMonth: tariffBundle.bhccByMonth,
        missingTariffMonths: tariffBundle.missingMonths,
        tariffSyncedOnMiss: tariffBundle.syncedOnMiss,
      })
    : null;

  const energySummary = reconcileSummaryFromRun(run);

  const audit = evaluateMpcPipelineDbConsistency({
    pipelineRunId: run.id,
    buildingId: run.buildingId,
    evalStart: run.evalStart,
    evalEnd: run.evalEnd,
    stepCount: run.stepCount,
    measuredElectricityKwh: run.measuredElectricityKwh,
    energyReconcileSummary: energySummary,
    replaySummary: {
      deltaCostPct: run.deltaCostPct ?? undefined,
      meaningfulDeltaPct: run.meaningfulDeltaPct ?? undefined,
    },
    replayStepRows,
    supervisoryCommands,
    energyReconcileHours,
    bhccHours,
    steps,
    capacityTariff,
    priceLoadShift,
    relationalArtifacts: {
      policyKpiCount: run._count.policyKpis,
      priceLoadBandCount: run._count.priceLoadShiftBands,
      chartPointCount: run._count.chartPoints,
      chartsGeneratedAt: run.chartsGeneratedAt,
    },
    persistedRunScalars: {
      stepCount: run.stepCount,
      totalCostBaselineKr: run.totalCostBaselineKr,
      totalCostEmulatedKr: run.totalCostEmulatedKr,
      totalCostMpcKr: run.totalCostMpcKr,
      totalCostDemandKr: run.totalCostDemandKr,
      deltaCostKr: run.deltaCostKr,
      deltaCostPct: run.deltaCostPct,
      deltaCostVsEmulatedKr: run.deltaCostVsEmulatedKr,
      deltaCostVsEmulatedPct: run.deltaCostVsEmulatedPct,
      peakElectricKwBaseline: run.peakElectricKwBaseline,
      peakElectricKwEmulated: run.peakElectricKwEmulated,
      peakElectricKwMpc: run.peakElectricKwMpc,
      controllableElectricKwhBaseline: run.controllableElectricKwhBaseline,
      controllableElectricKwhEmulated: run.controllableElectricKwhEmulated,
      controllableElectricKwhMpc: run.controllableElectricKwhMpc,
      controllableHeatKwhBaseline: run.controllableHeatKwhBaseline,
      controllableHeatKwhEmulated: run.controllableHeatKwhEmulated,
      controllableHeatKwhMpc: run.controllableHeatKwhMpc,
      comfortViolationsMpc: run.comfortViolationsMpc,
      comfortViolationsBaseline: run.comfortViolationsBaseline,
      comfortViolationsEmulated: run.comfortViolationsEmulated,
      comfortViolationsDemand: run.comfortViolationsDemand,
      fallbackSteps: run.fallbackSteps,
    },
  });

  await persistPipelineVerificationResult(pipelineRunId, audit.health);

  return audit;
}

async function persistPipelineVerificationResult(
  pipelineRunId: string,
  health: "pass" | "warn" | "fail",
): Promise<void> {
  try {
    await prisma.sdAnleggMpcPipelineRun.update({
      where: { id: pipelineRunId },
      data: {
        verificationHealth: health,
        verifiedAt: new Date(),
      },
    });
  } catch {
    // Kolonner kan mangle før migrasjon — audit skal ikke feile av den grunn.
  }
}

export async function auditLatestMpcPipelineRun(
  buildingId: string,
): Promise<MpcPipelineDbAudit | null> {
  const run = await prisma.sdAnleggMpcPipelineRun.findFirst({
    where: { buildingId, stepCount: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!run) return null;
  return auditMpcPipelineRun(run.id);
}
