import "server-only";

import { Prisma } from "@/generated/client";
import { prisma } from "@/lib/db";
import { MPC_CONTROL_MODEL_VERSION } from "@/lib/sd-anlegg/control/control-constants";
import {
  loadLiveMpcStateRow,
  resolveForwardPlansFromLiveRow,
  type LiveMpcStateRow,
} from "./load-live-mpc-state-row";
import type { LiveForwardPlans, MpcForwardPlan } from "./control-types";

export async function loadPersistedForwardPlans(
  buildingId: string,
  liveMpcStateRow?: LiveMpcStateRow | null,
): Promise<LiveForwardPlans | null> {
  try {
    const row =
      liveMpcStateRow !== undefined
        ? liveMpcStateRow
        : await loadLiveMpcStateRow(buildingId);
    return resolveForwardPlansFromLiveRow(row);
  } catch {
    return null;
  }
}

export async function loadPersistedMpcForwardPlan(
  buildingId: string,
  liveMpcStateRow?: LiveMpcStateRow | null,
): Promise<MpcForwardPlan | null> {
  const plans = await loadPersistedForwardPlans(buildingId, liveMpcStateRow);
  return plans?.["mpc-v1"] ?? null;
}

export async function persistMpcForwardPlan(input: {
  buildingId: string;
  forwardPlan: MpcForwardPlan;
  forwardPlans?: LiveForwardPlans;
  mpcRunId: string;
}): Promise<void> {
  await prisma.sdAnleggLiveMpcState.upsert({
    where: { buildingId: input.buildingId },
    create: {
      buildingId: input.buildingId,
      modelVersion: MPC_CONTROL_MODEL_VERSION,
      calibrationFingerprint: input.mpcRunId,
      forwardPlan: input.forwardPlan as Prisma.InputJsonValue,
      forwardPlans: (input.forwardPlans ?? null) as Prisma.InputJsonValue,
    },
    update: {
      calibrationFingerprint: input.mpcRunId,
      forwardPlan: input.forwardPlan as Prisma.InputJsonValue,
      forwardPlans: (input.forwardPlans ?? undefined) as Prisma.InputJsonValue,
    },
  });
}
