import "server-only";

import { prisma } from "@/lib/db";
import type { LiveMpcStateRow } from "../load-live-mpc-state-row";
import type {
  ControlPlanDiff,
  ControlTickHistoryEntry,
  ControlTickState,
} from "../control-types-live";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";

function mapTickRow(row: {
  id: string;
  tickAt: Date;
  triggerSource: string;
  planDiff: unknown;
  activeCommand: unknown;
  forwardPlanEffect: unknown;
}): ControlTickHistoryEntry {
  const planDiff = (row.planDiff as ControlPlanDiff | null) ?? null;
  const effectFromPlan =
    (row.forwardPlanEffect as { deltaCostKr?: number } | null)?.deltaCostKr ??
    null;
  return {
    id: row.id,
    tickAt: row.tickAt.toISOString(),
    triggerSource: row.triggerSource,
    planDiff,
    activeCommand: (row.activeCommand as MpcControlVector) ?? null,
    effectDeltaKr: effectFromPlan ?? planDiff?.effectDeltaKr ?? null,
  };
}

export async function loadControlTickWorkspace(
  buildingId: string,
  historyLimit = 24,
  options?: { liveMpcStateRow?: LiveMpcStateRow | null },
): Promise<{
  tickState: ControlTickState | null;
  history: ControlTickHistoryEntry[];
}> {
  const liveRowPromise =
    options?.liveMpcStateRow !== undefined
      ? Promise.resolve(options.liveMpcStateRow)
      : prisma.sdAnleggLiveMpcState.findUnique({
          where: { buildingId },
          select: {
            lastControlTickAt: true,
            lastPlanDiff: true,
            activeCommand: true,
          },
        });

  const [liveRow, tickRows] = await Promise.all([
    liveRowPromise,
    prisma.sdAnleggControlTick.findMany({
      where: { buildingId },
      orderBy: { tickAt: "desc" },
      take: historyLimit,
      select: {
        id: true,
        tickAt: true,
        triggerSource: true,
        planDiff: true,
        activeCommand: true,
        forwardPlanEffect: true,
      },
    }),
  ]);

  const tickState: ControlTickState | null = liveRow
    ? {
        lastControlTickAt: liveRow.lastControlTickAt?.toISOString() ?? null,
        planDiff: (liveRow.lastPlanDiff as ControlPlanDiff | null) ?? null,
        activeCommand: (liveRow.activeCommand as MpcControlVector | null) ?? null,
      }
    : null;

  return {
    tickState,
    history: tickRows.map(mapTickRow),
  };
}
