import "server-only";

import { ensurePrismaConnection, prisma, withPrismaRetry } from "@/lib/db";
import { MpcSimulationStatus as PrismaMpcSimulationStatus, Prisma } from "@/generated/client";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import {
  MPC_SIMULATION_STALE_MAX_RUNTIME_MS,
  MPC_SIMULATION_STALE_NO_PROGRESS_MS,
  MPC_SIMULATION_RECENT_JOB_MS,
  MPC_SIMULATION_RESUME_WINDOW_MS,
} from "./control-constants";
import {
  parseMpcSimulationCheckpoint,
  type MpcSimulationCheckpoint,
} from "./mpc-simulation-checkpoint";
import {
  shouldKeepFailedSimulationVisible,
} from "./resolve-ui-pipeline-run";

export type MpcSimulationProgressStatus = "idle" | "running" | "completed" | "failed";

let lastProgressDbWarnMs = 0;

function warnProgressDbFailure(
  operation: string,
  meta: Record<string, unknown>,
  error: unknown,
): void {
  const now = Date.now();
  if (now - lastProgressDbWarnMs < 30_000) return;
  lastProgressDbWarnMs = now;
  console.warn(`[mpc-simulation] ${operation} failed (non-fatal):`, {
    ...meta,
    error: error instanceof Error ? error.message : String(error),
  });
}

export type MpcSimulationProgress = {
  status: MpcSimulationProgressStatus;
  stepIndex: number;
  stepTotal: number;
  message: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  activePipelineRunId: string | null;
  pct: number | null;
  /** RUNNING uten fremdrift / for lenge — sannsynlig hengende bakgrunnsjobb. */
  stale?: boolean;
};

function isSimulationJobStale(job: {
  status: string;
  stepIndex: number;
  stepTotal: number;
  startedAt: Date;
}): boolean {
  if (job.status !== PrismaMpcSimulationStatus.RUNNING) return false;
  const ageMs = Date.now() - job.startedAt.getTime();
  const incomplete =
    job.stepTotal > 0 && job.stepIndex < job.stepTotal;
  if (incomplete && ageMs >= MPC_SIMULATION_STALE_NO_PROGRESS_MS) {
    return true;
  }
  if (job.stepIndex <= 0 && ageMs >= MPC_SIMULATION_STALE_NO_PROGRESS_MS) {
    return true;
  }
  return ageMs >= MPC_SIMULATION_STALE_MAX_RUNTIME_MS;
}

function mapJobStatus(status: string): MpcSimulationProgressStatus {
  switch (status) {
    case PrismaMpcSimulationStatus.RUNNING:
      return "running";
    case PrismaMpcSimulationStatus.COMPLETED:
      return "completed";
    case PrismaMpcSimulationStatus.FAILED:
      return "failed";
    default:
      return "idle";
  }
}

function toProgress(job: {
  status: string;
  stepIndex: number;
  stepTotal: number;
  message: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  pipelineRunId: string | null;
}): MpcSimulationProgress {
  const pct =
    job.stepTotal > 0
      ? Math.min(100, Math.round((job.stepIndex / job.stepTotal) * 100))
      : null;
  return {
    status: mapJobStatus(job.status),
    stepIndex: job.stepIndex,
    stepTotal: job.stepTotal,
    message: job.message,
    startedAt: job.startedAt.toISOString(),
    updatedAt: (job.finishedAt ?? job.startedAt).toISOString(),
    activePipelineRunId: job.pipelineRunId,
    pct,
    stale: isSimulationJobStale({
      status: job.status,
      stepIndex: job.stepIndex,
      stepTotal: job.stepTotal,
      startedAt: job.startedAt,
    }),
  };
}

async function activeJob(buildingId: string) {
  const live = await prisma.sdAnleggLiveMpcState.findUnique({
    where: { buildingId },
    select: {
      activeSimulationJob: {
        select: {
          status: true,
          stepIndex: true,
          stepTotal: true,
          message: true,
          startedAt: true,
          finishedAt: true,
          pipelineRunId: true,
        },
      },
    },
  });
  if (live?.activeSimulationJob) return live.activeSimulationJob;

  const latest = await prisma.sdAnleggMpcSimulationJob.findFirst({
    where: { buildingId },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      stepIndex: true,
      stepTotal: true,
      message: true,
      startedAt: true,
      finishedAt: true,
      pipelineRunId: true,
      checkpoint: true,
    },
  });
  if (!latest) return null;

  if (latest.status === PrismaMpcSimulationStatus.RUNNING) {
    return latest;
  }

  if (
    latest.status === PrismaMpcSimulationStatus.FAILED &&
    shouldKeepFailedSimulationVisible({
      status: latest.status,
      checkpoint: latest.checkpoint,
      stepIndex: latest.stepIndex,
      stepTotal: latest.stepTotal,
    })
  ) {
    return latest;
  }

  const finishedAt = latest.finishedAt ?? latest.startedAt;
  if (Date.now() - finishedAt.getTime() > MPC_SIMULATION_RECENT_JOB_MS) {
    return null;
  }

  return latest;
}

export async function loadMpcSimulationProgress(
  buildingId: string,
): Promise<MpcSimulationProgress | null> {
  await recoverStaleMpcSimulationJob(buildingId);
  const job = await activeJob(buildingId);
  if (!job) return null;
  return toProgress(job);
}

export async function recoverStaleMpcSimulationJob(
  buildingId: string,
): Promise<{ recovered: boolean; jobId: string | null; reason: string | null }> {
  const live = await prisma.sdAnleggLiveMpcState.findUnique({
    where: { buildingId },
    select: {
      activeSimulationJob: {
        select: {
          id: true,
          status: true,
          stepIndex: true,
          stepTotal: true,
          startedAt: true,
        },
      },
    },
  });
  const job = live?.activeSimulationJob;
  if (!job || job.status !== PrismaMpcSimulationStatus.RUNNING) {
    return { recovered: false, jobId: null, reason: null };
  }
  if (
    !isSimulationJobStale({
      status: job.status,
      stepIndex: job.stepIndex,
      stepTotal: job.stepTotal,
      startedAt: job.startedAt,
    })
  ) {
    return { recovered: false, jobId: job.id, reason: null };
  }

  const ageMin = Math.round((Date.now() - job.startedAt.getTime()) / 60_000);
  const reason =
    job.stepIndex <= 0
      ? `Simulering henger uten fremdrift (${ageMin} min) — kan gjenopptas`
      : `Simulering avbrutt etter ${job.stepIndex} steg (${ageMin} min) — fortsetter ved neste kjøring`;

  await markMpcSimulationFinished({
    buildingId,
    jobId: job.id,
    status: "failed",
    message: reason,
  });

  console.warn("[mpc-simulation] recovered stale job:", {
    buildingId,
    jobId: job.id,
    stepIndex: job.stepIndex,
    ageMin,
  });

  return { recovered: true, jobId: job.id, reason };
}

export async function dismissMpcSimulationJobNotice(
  buildingId: string,
): Promise<void> {
  await prisma.sdAnleggLiveMpcState.updateMany({
    where: { buildingId },
    data: { activeSimulationJobId: null },
  });
}

export async function cancelActiveMpcSimulationJob(input: {
  buildingId: string;
  message?: string;
}): Promise<boolean> {
  const jobId = await resolveJobId({ buildingId: input.buildingId });
  if (!jobId) return false;

  const running = await prisma.sdAnleggMpcSimulationJob.findFirst({
    where: {
      id: jobId,
      status: PrismaMpcSimulationStatus.RUNNING,
    },
    select: { id: true },
  });
  if (!running) return false;

  await markMpcSimulationFinished({
    buildingId: input.buildingId,
    jobId,
    status: "failed",
    message: input.message ?? "Simulering avbrutt — starter på nytt",
  });
  await prisma.sdAnleggMpcSimulationJob.updateMany({
    where: { id: jobId },
    data: { checkpoint: Prisma.DbNull },
  });
  return true;
}

async function resolveJobId(input: {
  buildingId?: string | null;
  jobId?: string | null;
}): Promise<string | null> {
  if (input.jobId?.trim()) return input.jobId;
  const buildingId = input.buildingId?.trim();
  if (!buildingId) return null;
  const live = await prisma.sdAnleggLiveMpcState.findUnique({
    where: { buildingId },
    select: { activeSimulationJobId: true },
  });
  return live?.activeSimulationJobId ?? null;
}

export async function markMpcSimulationRunning(input: {
  buildingId: string;
  stepTotal: number;
  message?: string;
}): Promise<string> {
  const job = await prisma.sdAnleggMpcSimulationJob.create({
    data: {
      buildingId: input.buildingId,
      status: PrismaMpcSimulationStatus.RUNNING,
      stepTotal: input.stepTotal,
      stepIndex: 0,
      message: input.message ?? "Kjører simulering…",
    },
    select: { id: true },
  });

  await prisma.sdAnleggLiveMpcState.upsert({
    where: { buildingId: input.buildingId },
    create: {
      buildingId: input.buildingId,
      calibrationFingerprint: "pending",
      activeSimulationJobId: job.id,
    },
    update: {
      activeSimulationJobId: job.id,
    },
  });

  return job.id;
}

export async function updateMpcSimulationProgress(input: {
  buildingId?: string | null;
  jobId?: string | null;
  stepIndex: number;
  stepTotal: number;
  message?: string;
}): Promise<void> {
  if (!input.jobId?.trim() && !input.buildingId?.trim()) return;
  try {
    await withPrismaRetry(
      async () => {
        await ensurePrismaConnection();
        const jobId = await resolveJobId(input);
        if (!jobId) return;
        await prisma.sdAnleggMpcSimulationJob.updateMany({
          where: { id: jobId, status: PrismaMpcSimulationStatus.RUNNING },
          data: {
            stepIndex: input.stepIndex,
            stepTotal: input.stepTotal,
            message: input.message ?? null,
          },
        });
      },
      { retries: 2, delayMs: 500 },
    );
  } catch (error) {
    warnProgressDbFailure("progress update", {
      buildingId: input.buildingId,
      jobId: input.jobId,
      stepIndex: input.stepIndex,
      stepTotal: input.stepTotal,
    }, error);
  }
}

export async function saveMpcSimulationCheckpoint(input: {
  buildingId: string;
  jobId: string;
  pipelineRunId: string;
  checkpoint: MpcSimulationCheckpoint;
  stepIndex: number;
  stepTotal: number;
  message?: string;
}): Promise<void> {
  await withPrismaRetry(
    async () => {
      await ensurePrismaConnection();
      await prisma.sdAnleggMpcSimulationJob.updateMany({
        where: {
          id: input.jobId,
          status: PrismaMpcSimulationStatus.RUNNING,
        },
        data: {
          checkpoint: input.checkpoint as object,
          pipelineRunId: input.pipelineRunId,
          stepIndex: input.stepIndex,
          stepTotal: input.stepTotal,
          message: input.message ?? null,
          startedAt: new Date(),
        },
      });
    },
    { retries: 3, delayMs: 500 },
  );
}

export async function loadMpcSimulationCheckpoint(
  jobId: string,
): Promise<MpcSimulationCheckpoint | null> {
  const job = await prisma.sdAnleggMpcSimulationJob.findUnique({
    where: { id: jobId },
    select: { checkpoint: true },
  });
  return parseMpcSimulationCheckpoint(job?.checkpoint);
}

/** Gjenoppta avbrutt jobb med gyldig checkpoint (innen resume-vindu). */
export async function resumeMpcSimulationJob(input: {
  buildingId: string;
  jobId: string;
  stepTotal: number;
  message?: string;
}): Promise<void> {
  await prisma.sdAnleggMpcSimulationJob.updateMany({
    where: { id: input.jobId },
    data: {
      status: PrismaMpcSimulationStatus.RUNNING,
      stepTotal: input.stepTotal,
      finishedAt: null,
      errorMessage: null,
      message: input.message ?? "Gjenopptar simulering…",
      startedAt: new Date(),
    },
  });

  await prisma.sdAnleggLiveMpcState.upsert({
    where: { buildingId: input.buildingId },
    create: {
      buildingId: input.buildingId,
      calibrationFingerprint: "pending",
      activeSimulationJobId: input.jobId,
    },
    update: {
      activeSimulationJobId: input.jobId,
    },
  });
}

export async function findResumableMpcSimulationJob(input: {
  buildingId: string;
}): Promise<{
  jobId: string;
  checkpoint: MpcSimulationCheckpoint;
  stepIndex: number;
  stepTotal: number;
} | null> {
  const since = new Date(Date.now() - MPC_SIMULATION_RESUME_WINDOW_MS);
  const job = await prisma.sdAnleggMpcSimulationJob.findFirst({
    where: {
      buildingId: input.buildingId,
      status: PrismaMpcSimulationStatus.FAILED,
      finishedAt: { gte: since },
    },
    orderBy: { finishedAt: "desc" },
    select: {
      id: true,
      stepIndex: true,
      stepTotal: true,
      checkpoint: true,
    },
  });
  if (!job) return null;
  const checkpoint = parseMpcSimulationCheckpoint(job.checkpoint);
  if (!checkpoint) return null;
  if (checkpoint.replayIndex <= 0) return null;
  if (job.stepTotal > 0 && checkpoint.replayIndex >= job.stepTotal) return null;
  return {
    jobId: job.id,
    checkpoint,
    stepIndex: job.stepIndex,
    stepTotal: job.stepTotal,
  };
}

export async function markMpcSimulationFinished(input: {
  buildingId?: string | null;
  jobId?: string | null;
  status: "completed" | "failed" | "idle";
  pipelineRunId?: string | null;
  message?: string;
}): Promise<void> {
  const buildingId = input.buildingId?.trim();
  const jobId = await resolveJobId(input);
  if (!jobId && !buildingId) return;
  const now = new Date();
  const prismaStatus =
    input.status === "completed"
      ? PrismaMpcSimulationStatus.COMPLETED
      : input.status === "failed"
        ? PrismaMpcSimulationStatus.FAILED
        : PrismaMpcSimulationStatus.IDLE;

  if (jobId) {
    await prisma.sdAnleggMpcSimulationJob.updateMany({
      where: { id: jobId },
      data: {
        status: prismaStatus,
        finishedAt: now,
        message: input.message ?? null,
        ...(input.pipelineRunId ? { pipelineRunId: input.pipelineRunId } : {}),
      },
    });
    if (input.status === "completed") {
      await prisma.sdAnleggMpcSimulationJob.updateMany({
        where: { id: jobId },
        data: { checkpoint: Prisma.DbNull },
      });
    }
  }

  if (input.status !== "idle" && buildingId) {
    await prisma.sdAnleggLiveMpcState.updateMany({
      where: {
        buildingId,
        ...(jobId ? { activeSimulationJobId: jobId } : {}),
      },
      data: { activeSimulationJobId: null },
    });
  } else if (input.status === "idle" && buildingId) {
    await prisma.sdAnleggLiveMpcState.updateMany({
      where: { buildingId },
      data: { activeSimulationJobId: null },
    });
  }
}

export function mpcReplayStepFromRelationalRow(row: {
  stepAt: Date;
  spotKrPerKwh: number | null;
  marginalKrPerKwh: number | null;
  outdoorTempC: number | null;
  costObservedKr: number | null;
  costEmulatedKr: number | null;
  costMpcKr: number | null;
  costDemandKr: number | null;
  usedFallback: boolean;
  fallbackReason?: string | null;
  proxyElKwhBaseline: number | null;
  proxyElKwhEmulated: number | null;
  proxyElKwhMpc: number | null;
  proxyElKwhDemand: number | null;
  proxyHeatKwhBaseline: number | null;
  proxyHeatKwhEmulated: number | null;
  proxyHeatKwhMpc: number | null;
  proxyHeatKwhDemand: number | null;
  electricKw: number | null;
  heatKw: number | null;
  buildingElectricityKwh: number | null;
  buildingDistrictHeatingKwh: number | null;
  districtMeterTr003PowerKw: number | null;
  districtMeterTr003EnergyKwh: number | null;
  extractTempMeasC: number | null;
  extractTempPredC: number | null;
  extractTempPredEmulatedC: number | null;
  extractTempPredDemandC: number | null;
  extractTempPredObservedC: number | null;
  comfortBandMinC: number | null;
  comfortBandMaxC: number | null;
  comfortViolation: boolean;
  comfortViolationEmulated: boolean;
  comfortViolationDemand: boolean;
  controlTracks?: readonly {
    track: string;
    supplySetpointC: number | null;
    supplyFanPct: number | null;
    exhaustFanPct: number | null;
    heatingValvePct: number | null;
    coolingValvePct: number | null;
    districtTr002ValvePct: number | null;
    districtTr003ValvePct: number | null;
  }[];
}): MpcReplayStep {
  const pickControl = (track: string) =>
    row.controlTracks?.find((t) => t.track === track);

  const uFrom = (
    t:
      | {
          supplySetpointC: number | null;
          supplyFanPct: number | null;
          exhaustFanPct: number | null;
          heatingValvePct: number | null;
          coolingValvePct: number | null;
          districtTr002ValvePct: number | null;
          districtTr003ValvePct: number | null;
        }
      | undefined,
  ) =>
    t
      ? {
          supplySetpointC: t.supplySetpointC ?? 0,
          supplyFanPct: t.supplyFanPct ?? 0,
          exhaustFanPct: t.exhaustFanPct ?? 0,
          heatingValvePct: t.heatingValvePct ?? 0,
          coolingValvePct: t.coolingValvePct ?? 0,
          districtTr002ValvePct: t.districtTr002ValvePct ?? undefined,
          districtTr003ValvePct: t.districtTr003ValvePct ?? undefined,
        }
      : undefined;

  return {
    t: row.stepAt.toISOString(),
    spotKrPerKwh: row.spotKrPerKwh ?? undefined,
    marginalKrPerKwh: row.marginalKrPerKwh ?? undefined,
    outdoorTempC: row.outdoorTempC ?? undefined,
    costBaselineKr: row.costObservedKr ?? 0,
    costEmulatedKr: row.costEmulatedKr ?? 0,
    costMpcKr: row.costMpcKr ?? 0,
    costDemandKr: row.costDemandKr ?? undefined,
    usedFallback: row.usedFallback,
    fallbackReason:
      (row.fallbackReason as MpcReplayStep["fallbackReason"]) ?? undefined,
    proxyElKwhBaseline: row.proxyElKwhBaseline ?? undefined,
    proxyElKwhEmulated: row.proxyElKwhEmulated ?? undefined,
    proxyElKwhMpc: row.proxyElKwhMpc ?? undefined,
    proxyElKwhDemand: row.proxyElKwhDemand ?? undefined,
    proxyHeatKwhBaseline: row.proxyHeatKwhBaseline ?? undefined,
    proxyHeatKwhEmulated: row.proxyHeatKwhEmulated ?? undefined,
    proxyHeatKwhMpc: row.proxyHeatKwhMpc ?? undefined,
    proxyHeatKwhDemand: row.proxyHeatKwhDemand ?? undefined,
    electricKw: row.electricKw ?? undefined,
    heatKw: row.heatKw ?? undefined,
    buildingElectricityKwh: row.buildingElectricityKwh ?? undefined,
    buildingDistrictHeatingKwh: row.buildingDistrictHeatingKwh ?? undefined,
    districtMeterTr003PowerKw: row.districtMeterTr003PowerKw ?? undefined,
    districtMeterTr003EnergyKwh: row.districtMeterTr003EnergyKwh ?? undefined,
    extractTempMeasC: row.extractTempMeasC ?? undefined,
    extractTempPredC: row.extractTempPredC ?? undefined,
    extractTempPredEmulatedC: row.extractTempPredEmulatedC ?? undefined,
    extractTempPredDemandC: row.extractTempPredDemandC ?? undefined,
    extractTempPredObservedC: row.extractTempPredObservedC ?? undefined,
    comfortBandMinC: row.comfortBandMinC ?? undefined,
    comfortBandMaxC: row.comfortBandMaxC ?? undefined,
    comfortViolation: row.comfortViolation,
    comfortViolationEmulated: row.comfortViolationEmulated,
    comfortViolationDemand: row.comfortViolationDemand,
    uBmsMeas: uFrom(pickControl("OBSERVED")),
    uBmsSim: uFrom(pickControl("EMULATED")),
    uMpc: uFrom(pickControl("MPC")) ?? {
      supplySetpointC: 0,
      supplyFanPct: 0,
      exhaustFanPct: 0,
      heatingValvePct: 0,
      coolingValvePct: 0,
    },
    uDemand: uFrom(pickControl("DEMAND")),
  } as MpcReplayStep;
}
