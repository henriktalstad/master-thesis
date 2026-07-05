import type { MpcControlVector, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

const FAN_ON_THRESHOLD_PCT = 5;
const HEAT_ON_THRESHOLD_PCT = 8;

function hasMeaningfulControl(u: MpcControlVector | null | undefined): boolean {
  if (!u) return false;
  return (
    u.supplyFanPct > FAN_ON_THRESHOLD_PCT ||
    u.exhaustFanPct > FAN_ON_THRESHOLD_PCT ||
    u.heatingValvePct > HEAT_ON_THRESHOLD_PCT ||
    u.coolingValvePct > HEAT_ON_THRESHOLD_PCT
  );
}

/** Velg start-u for forward plan — live uMeas vinner alltid når den finnes. */
export function resolveMpcInitialControl(input: {
  override?: MpcControlVector | null;
  replaySteps?: readonly MpcReplayStep[];
}): MpcControlVector | null {
  if (input.override != null) {
    return input.override;
  }

  const steps = input.replaySteps ?? [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const u = steps[i]?.uBmsMeas;
    if (hasMeaningfulControl(u)) return u!;
  }

  const last = steps.at(-1);
  return last?.uBmsMeas ?? last?.uBmsSim ?? null;
}

/** Live-loop: bruk eval-replay kun når live mangler måling helt. */
export function pickReplayStepsForForwardPlan(input: {
  loopSteps: readonly MpcReplayStep[];
  evalReplaySteps?: readonly MpcReplayStep[];
}): readonly MpcReplayStep[] {
  const loopLast = input.loopSteps.at(-1);
  if (loopLast?.uBmsMeas != null) {
    return input.loopSteps;
  }
  if (input.evalReplaySteps?.length) {
    return input.evalReplaySteps.slice(-96);
  }
  return input.loopSteps;
}
