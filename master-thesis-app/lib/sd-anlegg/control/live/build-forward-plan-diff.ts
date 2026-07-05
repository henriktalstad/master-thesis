import type { ControlPlanDiff, MpcForwardPlan } from "../control-types-live";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";
import { MPC_CONTROL_KEYS } from "@/lib/sd-anlegg/mpc/shared/types";

const DIFF_EPS = 0.05;

function vectorDelta(
  prev: MpcControlVector | null | undefined,
  next: MpcControlVector,
): Partial<Record<keyof MpcControlVector, number>> {
  if (!prev) return {};
  const delta: Partial<Record<keyof MpcControlVector, number>> = {};
  for (const key of MPC_CONTROL_KEYS) {
    const d = next[key] - prev[key];
    if (Math.abs(d) >= DIFF_EPS) {
      delta[key] = Math.round(d * 10) / 10;
    }
  }
  return delta;
}

function countHorizonChanges(
  previous: MpcForwardPlan | null,
  current: MpcForwardPlan,
): { count: number; firstChangedStepAt: string | null } {
  if (!previous?.planSteps.length) {
    return { count: 0, firstChangedStepAt: null };
  }

  let count = 0;
  let firstChangedStepAt: string | null = null;
  const limit = Math.min(previous.planSteps.length, current.planSteps.length, 32);

  for (let i = 0; i < limit; i++) {
    const prevStep = previous.planSteps[i]!;
    const currStep = current.planSteps[i]!;
    const changed = MPC_CONTROL_KEYS.some(
      (key) =>
        Math.abs(prevStep.uMpc[key] - currStep.uMpc[key]) >= DIFF_EPS,
    );
    if (changed) {
      count += 1;
      if (!firstChangedStepAt) firstChangedStepAt = currStep.t;
    }
  }

  return { count, firstChangedStepAt };
}

function formatDeltaSummary(
  delta: Partial<Record<keyof MpcControlVector, number>>,
): string {
  const parts: string[] = [];
  if (delta.supplySetpointC != null) {
    parts.push(`tilluft SP ${delta.supplySetpointC > 0 ? "+" : ""}${delta.supplySetpointC} °C`);
  }
  if (delta.supplyFanPct != null) {
    parts.push(`tilluftvifte ${delta.supplyFanPct > 0 ? "+" : ""}${delta.supplyFanPct} %`);
  }
  if (delta.exhaustFanPct != null) {
    parts.push(`avtrekk ${delta.exhaustFanPct > 0 ? "+" : ""}${delta.exhaustFanPct} %`);
  }
  if (delta.heatingValvePct != null) {
    parts.push(`varme ${delta.heatingValvePct > 0 ? "+" : ""}${delta.heatingValvePct} %`);
  }
  if (delta.coolingValvePct != null) {
    parts.push(`kjøle ${delta.coolingValvePct > 0 ? "+" : ""}${delta.coolingValvePct} %`);
  }
  return parts.length > 0 ? parts.join(" · ") : "ingen vesentlig endring i aktiv kommando";
}

export function buildForwardPlanDiff(input: {
  previous: MpcForwardPlan | null;
  current: MpcForwardPlan;
}): ControlPlanDiff {
  const prevActive = input.previous?.planSteps[0]?.uMpc ?? null;
  const currActive = input.current.planSteps[0]?.uMpc;
  if (!currActive) {
    return {
      previousComputedAt: input.previous?.computedAt ?? null,
      currentComputedAt: input.current.computedAt,
      activeCommandDelta: {},
      effectDeltaKr: null,
      effectDeltaPct: null,
      horizonStepsChanged: 0,
      firstChangedStepAt: null,
      summary: "ingen plan tilgjengelig",
    };
  }

  const activeCommandDelta = vectorDelta(prevActive, currActive);
  const { count: horizonStepsChanged, firstChangedStepAt } = countHorizonChanges(
    input.previous,
    input.current,
  );

  const effectDeltaKr =
    input.previous != null
      ? Math.round(
          (input.current.effect.deltaCostKr - input.previous.effect.deltaCostKr) *
            100,
        ) / 100
      : null;
  const effectDeltaPct =
    input.previous != null && input.previous.effect.totalCostBaselineKr > 0
      ? Math.round(
          ((input.current.effect.deltaCostPct -
            input.previous.effect.deltaCostPct) *
            10) /
            10,
        )
      : null;

  const summary =
    Object.keys(activeCommandDelta).length > 0
      ? formatDeltaSummary(activeCommandDelta)
      : horizonStepsChanged > 0
        ? `${horizonStepsChanged} horisont-steg endret — aktiv kommando uendret`
        : "plan oppdatert uten vesentlige endringer";

  return {
    previousComputedAt: input.previous?.computedAt ?? null,
    currentComputedAt: input.current.computedAt,
    activeCommandDelta,
    effectDeltaKr,
    effectDeltaPct,
    horizonStepsChanged,
    firstChangedStepAt,
    summary,
  };
}
