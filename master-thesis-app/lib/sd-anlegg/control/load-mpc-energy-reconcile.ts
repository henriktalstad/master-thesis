import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  buildMpcEnergyReconcile,
  type MpcEnergyReconcileHourRow,
  type MpcEnergyReconcileSummary,
} from "./build-mpc-energy-reconcile";
import { isIncompleteReconcileSummary } from "./energy-reconcile-summary-utils";
import type { MpcCalibrationBundle, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcPipelineRunRecord } from "./control-types";
import { parsePersistedCalibrationPayload } from "./build-mpc-pipeline-run-scalars";
import { loadPipelineReplaySteps } from "./persist-mpc-pipeline-replay-steps";

export type MpcEnergyReconcileBundle = {
  summary: MpcEnergyReconcileSummary;
  hours: Array<{
    hour: string;
    measuredElectricityKwh: number;
    measuredDistrictHeatingKwh: number;
    measuredCostKr: number;
    proxyEmulatedElKwh: number;
    proxyMpcElKwh: number;
    proxyEmulatedHeatKwh: number;
    proxyMpcHeatKwh: number;
    proxyEmulatedCostKr: number;
    proxyMpcCostKr: number;
  }>;
  /** true når tall kommer fra normaliserte time-rader; false = beregnet on-read fra replaySteps + BHCC */
  persisted: boolean;
};

function mapHourRows(rows: readonly MpcEnergyReconcileHourRow[]): MpcEnergyReconcileBundle["hours"] {
  return rows.map((row) => ({
    hour: row.hour,
    measuredElectricityKwh: row.measuredElectricityKwh,
    measuredDistrictHeatingKwh: row.measuredDistrictHeatingKwh,
    measuredCostKr: row.measuredCostKr,
    proxyEmulatedElKwh: row.proxyEmulatedElKwh,
    proxyMpcElKwh: row.proxyMpcElKwh,
    proxyEmulatedHeatKwh: row.proxyEmulatedHeatKwh,
    proxyMpcHeatKwh: row.proxyMpcHeatKwh,
    proxyEmulatedCostKr: row.proxyEmulatedCostKr,
    proxyMpcCostKr: row.proxyMpcCostKr,
  }));
}

/** BHCC + replaySteps + kalibrering — uten å kreve backfill. */
export async function computeMpcEnergyReconcileFromRun(input: {
  buildingId: string;
  evalStart: Date;
  evalEnd: Date;
  steps: readonly MpcReplayStep[];
  calibration: MpcCalibrationBundle;
}): Promise<MpcEnergyReconcileBundle> {
  const bhccRows = await prisma.buildingHourlyCostCache.findMany({
    where: {
      buildingId: input.buildingId,
      hour: { gte: input.evalStart, lt: input.evalEnd },
    },
    orderBy: { hour: "asc" },
    select: {
      hour: true,
      electricityVolumeKwh: true,
      districtHeatingVolumeKwh: true,
      electricityTotalCost: true,
      districtHeatingTotalCost: true,
    },
  });

  const { summary, hours } = buildMpcEnergyReconcile({
    evalStart: input.evalStart.toISOString(),
    evalEnd: input.evalEnd.toISOString(),
    steps: input.steps,
    calibration: input.calibration,
    bhccRows,
  });

  return { summary, hours: mapHourRows(hours), persisted: false };
}

export async function resolveEnergyReconcileForExport(input: {
  buildingId: string;
  run: MpcPipelineRunRecord;
}): Promise<MpcEnergyReconcileSummary | null> {
  const stub = input.run.energyReconcileSummary;
  if (stub && !isIncompleteReconcileSummary(stub)) {
    return stub;
  }
  if (!input.run.calibration || input.run.replaySteps.length === 0) {
    return stub ?? null;
  }

  const bundle = await computeMpcEnergyReconcileFromRun({
    buildingId: input.buildingId,
    evalStart: new Date(input.run.snapshot.evalStart),
    evalEnd: new Date(input.run.snapshot.evalEnd),
    steps: input.run.replaySteps,
    calibration: input.run.calibration,
  });
  return bundle.summary;
}

async function loadPersistedEnergyReconcileHours(
  pipelineRunId: string,
): Promise<MpcEnergyReconcileBundle["hours"]> {
  const rows = await prisma.sdAnleggMpcEnergyReconcileHour.findMany({
    where: { pipelineRunId },
    orderBy: { hour: "asc" },
    select: {
      hour: true,
      measuredElectricityKwh: true,
      measuredDistrictHeatingKwh: true,
      measuredCostKr: true,
      proxyEmulatedElKwh: true,
      proxyMpcElKwh: true,
      proxyEmulatedHeatKwh: true,
      proxyMpcHeatKwh: true,
      proxyEmulatedCostKr: true,
      proxyMpcCostKr: true,
    },
  });

  return rows.map((row) => ({
    hour: row.hour.toISOString(),
    measuredElectricityKwh: row.measuredElectricityKwh,
    measuredDistrictHeatingKwh: row.measuredDistrictHeatingKwh,
    measuredCostKr: row.measuredCostKr,
    proxyEmulatedElKwh: row.proxyEmulatedElKwh,
    proxyMpcElKwh: row.proxyMpcElKwh,
    proxyEmulatedHeatKwh: row.proxyEmulatedHeatKwh,
    proxyMpcHeatKwh: row.proxyMpcHeatKwh,
    proxyEmulatedCostKr: row.proxyEmulatedCostKr,
    proxyMpcCostKr: row.proxyMpcCostKr,
  }));
}

export const loadMpcEnergyReconcileForRun = cache(
  async (pipelineRunId: string): Promise<MpcEnergyReconcileBundle | null> => {
    const run = await prisma.sdAnleggMpcPipelineRun.findUnique({
      where: { id: pipelineRunId },
      select: {
        buildingId: true,
        evalStart: true,
        evalEnd: true,
        calibration: true,
      },
    });
    if (!run?.calibration) return null;

    const { calibration } = parsePersistedCalibrationPayload(run.calibration);
    if (!calibration) return null;

    const persistedHours = await loadPersistedEnergyReconcileHours(pipelineRunId);
    const steps = await loadPipelineReplaySteps({ pipelineRunId });
    if (steps.length === 0) {
      if (persistedHours.length === 0) return null;
      return {
        summary: {
          evalStart: run.evalStart.toISOString(),
          evalEnd: run.evalEnd.toISOString(),
          hoursAligned: persistedHours.length,
          measured: {
            electricityKwh: 0,
            districtHeatingKwh: 0,
            totalCostKr: 0,
            hours: persistedHours.length,
          },
          proxy: {
            observed: { elKwh: 0, heatKwh: 0, costKr: 0 },
            emulated: { elKwh: 0, heatKwh: 0, costKr: 0 },
            mpc: { elKwh: 0, heatKwh: 0, costKr: 0 },
          },
          shares: {
            controllableElectricShare: 0,
            controllableHeatShare: 0,
            proxyElectricShareOfMeasured: null,
            proxyHeatShareOfMeasured: null,
            proxyHeatShareOfCircuit: null,
            heatGroundTruth: "none",
          },
          deltaMpcVsEmulated: { costKr: 0, costPct: 0, elKwh: 0, heatKwh: 0 },
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
        },
        hours: persistedHours,
        persisted: true,
      };
    }

    const computed = await computeMpcEnergyReconcileFromRun({
      buildingId: run.buildingId,
      evalStart: run.evalStart,
      evalEnd: run.evalEnd,
      steps,
      calibration,
    });

    return {
      summary: {
        ...computed.summary,
        hoursAligned:
          persistedHours.length > 0
            ? persistedHours.length
            : computed.summary.hoursAligned,
      },
      hours: persistedHours.length > 0 ? persistedHours : computed.hours,
      persisted: persistedHours.length > 0,
    };
  },
);

/** Siste pipeline-run med replay — bruker BHCC + replaySteps når reconcile ikke er backfilled. */
export async function loadLatestMpcEnergyReconcile(
  buildingId: string,
): Promise<MpcEnergyReconcileBundle | null> {
  const run = await prisma.sdAnleggMpcPipelineRun.findFirst({
    where: { buildingId, stepCount: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!run) return null;
  return loadMpcEnergyReconcileForRun(run.id);
}

export { isIncompleteReconcileSummary };
