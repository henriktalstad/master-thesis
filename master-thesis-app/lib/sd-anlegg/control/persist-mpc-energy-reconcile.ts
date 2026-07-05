import "server-only";

import { prisma } from "@/lib/db";
import {
  buildMpcEnergyReconcile,
  type MpcEnergyReconcileSummary,
} from "./build-mpc-energy-reconcile";
import type { MpcCalibrationBundle, MpcPipelineResult, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

const HOUR_CHUNK = 200;

export async function persistMpcEnergyReconcile(input: {
  pipelineRunId: string;
  buildingId: string;
  result: MpcPipelineResult;
}): Promise<{
  summary: MpcEnergyReconcileSummary;
  hoursWritten: number;
}> {
  return persistMpcEnergyReconcileFromSteps({
    pipelineRunId: input.pipelineRunId,
    buildingId: input.buildingId,
    evalStart: input.result.evalStart,
    evalEnd: input.result.evalEnd,
    steps: input.result.replay.steps,
    calibration: input.result.calibration as MpcCalibrationBundle,
  });
}

export async function persistMpcEnergyReconcileFromSteps(input: {
  pipelineRunId: string;
  buildingId: string;
  evalStart: string;
  evalEnd: string;
  steps: readonly MpcReplayStep[];
  calibration: MpcCalibrationBundle;
}): Promise<{
  summary: MpcEnergyReconcileSummary;
  hoursWritten: number;
}> {
  const { pipelineRunId, buildingId } = input;

  const bhccRows = await prisma.buildingHourlyCostCache.findMany({
    where: {
      buildingId,
      hour: {
        gte: new Date(input.evalStart),
        lt: new Date(input.evalEnd),
      },
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
    evalStart: input.evalStart,
    evalEnd: input.evalEnd,
    steps: input.steps,
    calibration: input.calibration,
    bhccRows,
  });

  await prisma.sdAnleggMpcEnergyReconcileHour.deleteMany({ where: { pipelineRunId } });

  for (let i = 0; i < hours.length; i += HOUR_CHUNK) {
    const chunk = hours.slice(i, i + HOUR_CHUNK);
    await prisma.sdAnleggMpcEnergyReconcileHour.createMany({
      data: chunk.map((row) => ({
        id: crypto.randomUUID(),
        pipelineRunId,
        hour: new Date(row.hour),
        measuredElectricityKwh: row.measuredElectricityKwh,
        measuredDistrictHeatingKwh: row.measuredDistrictHeatingKwh,
        measuredCostKr: row.measuredCostKr,
        proxyObservedElKwh: row.proxyObservedElKwh,
        proxyEmulatedElKwh: row.proxyEmulatedElKwh,
        proxyMpcElKwh: row.proxyMpcElKwh,
        proxyObservedHeatKwh: row.proxyObservedHeatKwh,
        proxyEmulatedHeatKwh: row.proxyEmulatedHeatKwh,
        proxyMpcHeatKwh: row.proxyMpcHeatKwh,
        proxyObservedCostKr: row.proxyObservedCostKr,
        proxyEmulatedCostKr: row.proxyEmulatedCostKr,
        proxyMpcCostKr: row.proxyMpcCostKr,
      })),
    });
  }

  await prisma.sdAnleggMpcPipelineRun.update({
    where: { id: pipelineRunId },
    data: {
      measuredElectricityKwh: summary.measured.electricityKwh,
      measuredDistrictHeatingKwh: summary.measured.districtHeatingKwh,
      measuredTotalCostKr: summary.measured.totalCostKr,
      proxyEmulatedCostKr: summary.proxy.emulated.costKr,
      proxyMpcCostKr: summary.proxy.mpc.costKr,
      deltaMpcVsEmulatedCostKr: summary.deltaMpcVsEmulated.costKr,
      deltaMpcVsEmulatedCostPct: summary.deltaMpcVsEmulated.costPct,
    },
  });

  return { summary, hoursWritten: hours.length };
}
