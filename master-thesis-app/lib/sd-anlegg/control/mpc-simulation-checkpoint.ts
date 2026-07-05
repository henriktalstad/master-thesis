import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";

/** Serialiserbar plant-/solver-tilstand mellom replay-batch. */
export type MpcReplayLoopState = {
  tExtObserved: number;
  tExtMpc: number;
  tExtEmulated: number;
  tExtDemand: number;
  tRecMpc: number | null;
  tRecEmulated: number | null;
  warmStartDelta?: MpcControlVector[];
  /** Siste utstedte anker — SP-ramping ved off-state fortsetter over batch-grense. */
  prevAppliedBmsSim?: MpcControlVector | null;
  prevAppliedMpc?: MpcControlVector | null;
};

export type MpcSimulationCheckpoint = {
  version: 1;
  replayIndex: number;
  inputFingerprint: string;
  pipelineRunId: string;
  loopState: MpcReplayLoopState;
};

export function parseMpcSimulationCheckpoint(
  value: unknown,
): MpcSimulationCheckpoint | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) return null;
  if (typeof raw.replayIndex !== "number" || !Number.isFinite(raw.replayIndex)) {
    return null;
  }
  if (typeof raw.inputFingerprint !== "string" || !raw.inputFingerprint) {
    return null;
  }
  if (typeof raw.pipelineRunId !== "string" || !raw.pipelineRunId) {
    return null;
  }
  const loopState = raw.loopState;
  if (!loopState || typeof loopState !== "object") return null;
  const ls = loopState as Record<string, unknown>;
  if (
    typeof ls.tExtObserved !== "number" ||
    typeof ls.tExtMpc !== "number" ||
    typeof ls.tExtEmulated !== "number"
  ) {
    return null;
  }
  const tExtEmulated = ls.tExtEmulated as number;
  const tExtDemand =
    ls.tExtDemand != null && Number.isFinite(ls.tExtDemand)
      ? (ls.tExtDemand as number)
      : tExtEmulated;

  return {
    version: 1,
    replayIndex: Math.max(0, Math.floor(raw.replayIndex)),
    inputFingerprint: raw.inputFingerprint,
    pipelineRunId: raw.pipelineRunId,
    loopState: {
      tExtObserved: ls.tExtObserved,
      tExtMpc: ls.tExtMpc,
      tExtEmulated,
      tExtDemand,
      tRecMpc:
        ls.tRecMpc != null && Number.isFinite(ls.tRecMpc)
          ? (ls.tRecMpc as number)
          : null,
      tRecEmulated:
        ls.tRecEmulated != null && Number.isFinite(ls.tRecEmulated)
          ? (ls.tRecEmulated as number)
          : null,
      warmStartDelta: Array.isArray(ls.warmStartDelta)
        ? (ls.warmStartDelta as MpcControlVector[])
        : undefined,
      prevAppliedBmsSim:
        ls.prevAppliedBmsSim && typeof ls.prevAppliedBmsSim === "object"
          ? (ls.prevAppliedBmsSim as MpcControlVector)
          : undefined,
      prevAppliedMpc:
        ls.prevAppliedMpc && typeof ls.prevAppliedMpc === "object"
          ? (ls.prevAppliedMpc as MpcControlVector)
          : undefined,
    },
  };
}
