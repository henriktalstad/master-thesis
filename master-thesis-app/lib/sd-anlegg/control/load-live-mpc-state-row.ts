import "server-only";

import { prisma } from "@/lib/db";
import type { LiveForwardPlans, MpcForwardPlan } from "./control-types";

export type LiveMpcStateRow = {
  lastControlTickAt: Date | null;
  replayWatermarkAt: Date | null;
  lastPlanDiff: unknown;
  activeCommand: unknown;
  forwardPlan: unknown;
  forwardPlans: unknown;
};

export async function loadLiveMpcStateRow(
  buildingId: string,
): Promise<LiveMpcStateRow | null> {
  return prisma.sdAnleggLiveMpcState.findUnique({
    where: { buildingId },
    select: {
      lastControlTickAt: true,
      replayWatermarkAt: true,
      lastPlanDiff: true,
      activeCommand: true,
      forwardPlan: true,
      forwardPlans: true,
    },
  });
}

export function resolveForwardPlansFromLiveRow(
  row: LiveMpcStateRow | null,
): LiveForwardPlans | null {
  if (!row) return null;
  if (row.forwardPlans) {
    return row.forwardPlans as LiveForwardPlans;
  }
  if (row.forwardPlan) {
    return { "mpc-v1": row.forwardPlan as MpcForwardPlan };
  }
  return null;
}

export function resolveMpcForwardPlanFromLiveRow(
  row: LiveMpcStateRow | null,
): MpcForwardPlan | null {
  return resolveForwardPlansFromLiveRow(row)?.["mpc-v1"] ?? null;
}
