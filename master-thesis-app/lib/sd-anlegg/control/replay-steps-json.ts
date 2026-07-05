import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

export function replayStepsFromJsonBlob(
  replayStepsJson: unknown,
  maxSteps?: number,
): MpcReplayStep[] {
  const steps = (replayStepsJson as MpcReplayStep[] | null) ?? [];
  if (maxSteps != null && steps.length > maxSteps) {
    return steps.slice(-maxSteps);
  }
  return steps;
}
