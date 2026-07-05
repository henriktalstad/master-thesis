import "server-only";

import { prisma, withPrismaRetry, ensurePrismaConnection } from "@/lib/db";
import { mpcReplayStepFromRelationalRow } from "@/lib/sd-anlegg/control/mpc-simulation-progress";
import type { MpcControlVector, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

const WRITE_BATCH = 32;
const TX_TIMEOUT_MS = 180_000;
const UPSERT_PARALLEL = 4;

const RELATIONAL_STEP_SELECT = {
  stepAt: true,
  spotKrPerKwh: true,
  marginalKrPerKwh: true,
  outdoorTempC: true,
  costObservedKr: true,
  costEmulatedKr: true,
  costMpcKr: true,
  costDemandKr: true,
  usedFallback: true,
  fallbackReason: true,
  proxyElKwhBaseline: true,
  proxyElKwhEmulated: true,
  proxyElKwhMpc: true,
  proxyElKwhDemand: true,
  proxyHeatKwhBaseline: true,
  proxyHeatKwhEmulated: true,
  proxyHeatKwhMpc: true,
  proxyHeatKwhDemand: true,
  electricKw: true,
  heatKw: true,
  buildingElectricityKwh: true,
  buildingDistrictHeatingKwh: true,
  districtMeterTr003PowerKw: true,
  districtMeterTr003EnergyKwh: true,
  extractTempMeasC: true,
  extractTempPredC: true,
  extractTempPredEmulatedC: true,
  extractTempPredDemandC: true,
  extractTempPredObservedC: true,
  comfortBandMinC: true,
  comfortBandMaxC: true,
  comfortViolation: true,
  comfortViolationEmulated: true,
  comfortViolationDemand: true,
  controlTracks: {
    select: {
      track: true,
      supplySetpointC: true,
      supplyFanPct: true,
      exhaustFanPct: true,
      heatingValvePct: true,
      coolingValvePct: true,
      districtTr002ValvePct: true,
      districtTr003ValvePct: true,
    },
  },
} as const;

function controlTrackData(
  track: "OBSERVED" | "EMULATED" | "MPC" | "DEMAND",
  u: MpcControlVector | undefined,
) {
  if (!u) return null;
  return {
    track,
    supplySetpointC: u.supplySetpointC,
    supplyFanPct: u.supplyFanPct,
    exhaustFanPct: u.exhaustFanPct,
    heatingValvePct: u.heatingValvePct,
    coolingValvePct: u.coolingValvePct,
    districtTr002ValvePct: u.districtTr002ValvePct ?? null,
    districtTr003ValvePct: u.districtTr003ValvePct ?? null,
  };
}

function relationalRowFromStep(input: {
  pipelineRunId: string;
  buildingId: string;
  step: MpcReplayStep;
}) {
  const { step } = input;
  const uMeas = step.uBmsMeas;
  const tracks = [
    controlTrackData("OBSERVED", step.uBmsMeas ?? undefined),
    controlTrackData("EMULATED", step.uBmsSim),
    controlTrackData("MPC", step.uMpc),
    controlTrackData("DEMAND", step.uDemand),
  ].filter((t): t is NonNullable<typeof t> => t != null);

  return {
    pipelineRunId: input.pipelineRunId,
    buildingId: input.buildingId,
    stepAt: new Date(step.t),
    stepMinutes: 15,
    spotKrPerKwh: step.spotKrPerKwh ?? step.marginalKrPerKwh ?? null,
    marginalKrPerKwh: step.marginalKrPerKwh ?? null,
    outdoorTempC: step.outdoorTempC ?? null,
    costObservedKr: uMeas ? step.costBaselineKr : null,
    costEmulatedKr: step.costEmulatedKr,
    costMpcKr: step.costMpcKr,
    costDemandKr: step.costDemandKr ?? null,
    usedFallback: step.usedFallback,
    fallbackReason: step.fallbackReason ?? null,
    proxyElKwhBaseline: step.proxyElKwhBaseline ?? null,
    proxyElKwhEmulated: step.proxyElKwhEmulated ?? null,
    proxyElKwhMpc: step.proxyElKwhMpc ?? null,
    proxyElKwhDemand: step.proxyElKwhDemand ?? null,
    proxyHeatKwhBaseline: step.proxyHeatKwhBaseline ?? null,
    proxyHeatKwhEmulated: step.proxyHeatKwhEmulated ?? null,
    proxyHeatKwhMpc: step.proxyHeatKwhMpc ?? null,
    proxyHeatKwhDemand: step.proxyHeatKwhDemand ?? null,
    electricKw: step.electricKw ?? null,
    heatKw: step.heatKw ?? null,
    buildingElectricityKwh: step.buildingElectricityKwh ?? null,
    buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh ?? null,
    districtMeterTr003PowerKw: step.districtMeterTr003PowerKw ?? null,
    districtMeterTr003EnergyKwh: step.districtMeterTr003EnergyKwh ?? null,
    extractTempMeasC: step.extractTempMeasC ?? null,
    extractTempPredC: step.extractTempPredC ?? null,
    extractTempPredEmulatedC: step.extractTempPredEmulatedC ?? null,
    extractTempPredDemandC: step.extractTempPredDemandC ?? null,
    extractTempPredObservedC: step.extractTempPredObservedC ?? null,
    comfortBandMinC: step.comfortBandMinC ?? null,
    comfortBandMaxC: step.comfortBandMaxC ?? null,
    comfortViolation: step.comfortViolation ?? false,
    comfortViolationEmulated: step.comfortViolationEmulated ?? false,
    comfortViolationDemand: step.comfortViolationDemand ?? false,
    controlTracks: tracks.length ? { create: tracks } : undefined,
  };
}

export async function replacePipelineReplaySteps(input: {
  pipelineRunId: string;
  buildingId: string;
  steps: readonly MpcReplayStep[];
}): Promise<{ stepsWritten: number }> {
  await ensurePrismaConnection();
  await withPrismaRetry(
    () =>
      prisma.sdAnleggMpcPipelineReplayStep.deleteMany({
        where: { pipelineRunId: input.pipelineRunId },
      }),
    { retries: 4, delayMs: 750 },
  );
  if (input.steps.length === 0) return { stepsWritten: 0 };

  let stepsWritten = 0;
  for (let i = 0; i < input.steps.length; i += WRITE_BATCH) {
    if (i > 0) {
      await ensurePrismaConnection();
    }
    const batch = input.steps.slice(i, i + WRITE_BATCH);
    await withPrismaRetry(
      () =>
        prisma.$transaction(
          async (tx) => {
            for (const step of batch) {
              await tx.sdAnleggMpcPipelineReplayStep.create({
                data: relationalRowFromStep({
                  pipelineRunId: input.pipelineRunId,
                  buildingId: input.buildingId,
                  step,
                }),
              });
            }
          },
          { timeout: TX_TIMEOUT_MS },
        ),
      { retries: 4, delayMs: 750 },
    );
    stepsWritten += batch.length;
  }

  console.log(
    `[mpc-persist] replay-rader ${stepsWritten}/${input.steps.length}`,
  );

  return { stepsWritten };
}
export async function upsertPipelineReplaySteps(input: {
  pipelineRunId: string;
  buildingId: string;
  steps: readonly MpcReplayStep[];
}): Promise<{ stepsWritten: number }> {
  if (input.steps.length === 0) return { stepsWritten: 0 };

  let stepsWritten = 0;
  for (let i = 0; i < input.steps.length; i += UPSERT_PARALLEL) {
    const chunk = input.steps.slice(i, i + UPSERT_PARALLEL);
    await Promise.all(
      chunk.map(async (step) => {
        const stepAt = new Date(step.t);
        const existing = await prisma.sdAnleggMpcPipelineReplayStep.findUnique({
          where: {
            pipelineRunId_stepAt_stepMinutes: {
              pipelineRunId: input.pipelineRunId,
              stepAt,
              stepMinutes: 15,
            },
          },
          select: { id: true },
        });
        if (existing) {
          await prisma.sdAnleggMpcPipelineReplayStep.delete({
            where: { id: existing.id },
          });
        }
        await prisma.sdAnleggMpcPipelineReplayStep.create({
          data: relationalRowFromStep({
            pipelineRunId: input.pipelineRunId,
            buildingId: input.buildingId,
            step,
          }),
        });
        stepsWritten += 1;
      }),
    );
  }

  const { upsertControlSignalHoursFromSteps } = await import(
    "@/lib/sd-anlegg/control/persist-control-signal-hours"
  );
  await upsertControlSignalHoursFromSteps({
    buildingId: input.buildingId,
    steps: input.steps,
    pipelineRunId: input.pipelineRunId,
  });

  return { stepsWritten };
}

export async function loadPipelineReplayStepsByRange(input: {
  pipelineRunId: string;
  since: Date;
  until?: Date;
}): Promise<MpcReplayStep[]> {
  const rows = await prisma.sdAnleggMpcPipelineReplayStep.findMany({
    where: {
      pipelineRunId: input.pipelineRunId,
      stepAt: {
        gte: input.since,
        ...(input.until ? { lte: input.until } : {}),
      },
    },
    orderBy: { stepAt: "asc" },
    select: RELATIONAL_STEP_SELECT,
  });
  if (rows.length === 0) return [];
  return rows.map((row) => mpcReplayStepFromRelationalRow(row));
}

export async function loadPipelineReplaySteps(input: {
  pipelineRunId: string;
  maxSteps?: number;
}): Promise<MpcReplayStep[]> {
  if (input.maxSteps != null && input.maxSteps > 0) {
    const rows = await prisma.sdAnleggMpcPipelineReplayStep.findMany({
      where: { pipelineRunId: input.pipelineRunId },
      orderBy: { stepAt: "desc" },
      take: input.maxSteps,
      select: RELATIONAL_STEP_SELECT,
    });
    if (rows.length > 0) {
      return rows.reverse().map((row) => mpcReplayStepFromRelationalRow(row));
    }
  }

  const rows = await prisma.sdAnleggMpcPipelineReplayStep.findMany({
    where: { pipelineRunId: input.pipelineRunId },
    orderBy: { stepAt: "asc" },
    select: RELATIONAL_STEP_SELECT,
  });

  if (rows.length === 0) return [];

  let steps = rows.map((row) => mpcReplayStepFromRelationalRow(row));
  if (input.maxSteps != null && steps.length > input.maxSteps) {
    steps = steps.slice(-input.maxSteps);
  }
  return steps;
}

export async function loadReplayStepsWithFallback(input: {
  pipelineRunId: string;
  maxSteps?: number;
}): Promise<MpcReplayStep[]> {
  return loadPipelineReplaySteps({
    pipelineRunId: input.pipelineRunId,
    maxSteps: input.maxSteps,
  });
}

export async function countPipelineReplaySteps(pipelineRunId: string): Promise<number> {
  return prisma.sdAnleggMpcPipelineReplayStep.count({
    where: { pipelineRunId },
  });
}
