import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";

export type ControlOpsSummary = {
  lastControlTickAt: string | null;
  shadowActive: boolean;
  planDiffSummary: string | null;
  hasForwardPlan: boolean;
  hasMpcReplay: boolean;
  forwardPlanComputedAt: string | null;
  replayDeltaCostPct: number | null;
  replayDeltaCostKr: number | null;
  replayStepCount: number | null;
};

export const loadControlOpsSummary = cache(
  async (buildingId: string): Promise<ControlOpsSummary> => {
    const [liveState, latestRun, latestTick] = await Promise.all([
      prisma.sdAnleggLiveMpcState.findUnique({
        where: { buildingId },
        select: { forwardPlan: true },
      }),
      prisma.sdAnleggMpcPipelineRun.findFirst({
        where: { buildingId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          stepCount: true,
          deltaCostPct: true,
          deltaCostKr: true,
        },
      }),
      prisma.sdAnleggControlTick.findFirst({
        where: { buildingId },
        orderBy: { tickAt: "desc" },
        select: { tickAt: true, planDiff: true },
      }),
    ]);

    const forwardPlan = liveState?.forwardPlan as
      | { computedAt?: string; horizonSteps?: number }
      | null
      | undefined;

    const planDiff = latestTick?.planDiff as { summary?: string } | null | undefined;
    return {
      lastControlTickAt: latestTick?.tickAt.toISOString() ?? null,
      shadowActive: latestTick != null,
      planDiffSummary: planDiff?.summary ?? null,
      hasForwardPlan: (forwardPlan?.horizonSteps ?? 0) > 0,
      hasMpcReplay: latestRun != null,
      forwardPlanComputedAt: forwardPlan?.computedAt ?? null,
      replayDeltaCostPct: latestRun?.deltaCostPct ?? null,
      replayDeltaCostKr: latestRun?.deltaCostKr ?? null,
      replayStepCount: latestRun?.stepCount ?? null,
    };
  },
);
