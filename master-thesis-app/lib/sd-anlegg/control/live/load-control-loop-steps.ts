import "server-only";

import { prisma } from "@/lib/db";
import {
  expandCompactMpcReplayStep,
  type CompactMpcReplayPayload,
} from "@/lib/sd-anlegg/control/compact-mpc-replay-step";
import { MPC_CONTROL_MODEL_VERSION } from "@/lib/sd-anlegg/control/control-constants";
import { mpcStepKeyFromMs } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function expandReplayRow(row: {
  stepAt: Date;
  payload: unknown;
}): MpcReplayStep {
  return expandCompactMpcReplayStep(
    row.stepAt.toISOString(),
    row.payload as CompactMpcReplayPayload,
  );
}

const LOOP_MAX_AGE_MS = 72 * 3_600_000;

/**
 * Kontinuerlig 15-min rekke fra inkrementell DB (`SdAnleggMpcReplayStep`).
 * Inkluderer både live control-tick og eval-backfill — brukes til grafer.
 */
export async function loadControlLoopStepsForLookback(
  buildingId: string,
  maxSteps: number,
  since: Date,
): Promise<MpcReplayStep[]> {
  const rows = await prisma.sdAnleggMpcReplayStep.findMany({
    where: {
      buildingId,
      modelVersion: MPC_CONTROL_MODEL_VERSION,
      stepAt: { gte: since },
    },
    orderBy: { stepAt: "desc" },
    take: maxSteps,
    select: {
      stepAt: true,
      payload: true,
    },
  });

  if (rows.length === 0) return [];
  return rows.reverse().map(expandReplayRow);
}

/** 15-min kontrollrekke fra control-tick (ekskluderer eval-backfill), nyeste sist. */
export async function loadControlLoopStepsForTicks(
  buildingId: string,
  maxTicks = 96,
): Promise<MpcReplayStep[]> {
  const cutoff = new Date(Date.now() - LOOP_MAX_AGE_MS);
  const ticks = await prisma.sdAnleggControlTick.findMany({
    where: { buildingId, tickAt: { gte: cutoff } },
    orderBy: { tickAt: "desc" },
    take: maxTicks,
    select: { tickAt: true },
  });
  if (ticks.length === 0) return [];

  const tickKeys = new Set(
    ticks.map((tick) => mpcStepKeyFromMs(tick.tickAt.getTime())),
  );
  const earliest = ticks[ticks.length - 1]!.tickAt;

  const rows = await prisma.sdAnleggMpcReplayStep.findMany({
    where: {
      buildingId,
      modelVersion: MPC_CONTROL_MODEL_VERSION,
      stepAt: { gte: earliest },
    },
    orderBy: { stepAt: "asc" },
    select: {
      stepAt: true,
      payload: true,
    },
  });

  return rows
    .filter((row) => tickKeys.has(mpcStepKeyFromMs(row.stepAt.getTime())))
    .map(expandReplayRow);
}

/** 15-min kontrollrekke fra inkrementell DB (live loop), nyeste sist. */
export async function loadControlLoopStepsTail(
  buildingId: string,
  maxSteps = 384,
): Promise<MpcReplayStep[]> {
  const rows = await prisma.sdAnleggMpcReplayStep.findMany({
    where: {
      buildingId,
      modelVersion: MPC_CONTROL_MODEL_VERSION,
    },
    orderBy: { stepAt: "desc" },
    take: maxSteps,
    select: {
      stepAt: true,
      payload: true,
    },
  });

  if (rows.length === 0) return [];

  return rows.reverse().map(expandReplayRow);
}
