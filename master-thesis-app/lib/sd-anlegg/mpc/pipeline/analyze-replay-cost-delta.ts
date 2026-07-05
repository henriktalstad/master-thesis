import { controlVectorNormSq, deltaControlVectors } from "@/lib/sd-anlegg/mpc/controller/optimizer/control-vector";
import { MEANINGFUL_DELTA_NORM_SQ } from "@/lib/sd-anlegg/mpc/pipeline/count-meaningful-delta-steps";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

export type ReplayCostDiagnosis = {
  stepCount: number;
  evalDaysApprox: number;
  totalCostBaselineKr: number;
  totalCostMpcKr: number;
  totalCostEmulatedKr: number | null;
  deltaCostKr: number;
  deltaCostPct: number;
  deltaCostVsEmulatedKr: number | null;
  meaningfulDeltaPct: number;
  /** Steg med meningsfull δu men ≤ 0,01 kr besparelse per steg. */
  highMoveLowSaveSteps: number;
  /** Andel av baseline-kost som kommer fra elektrisitet vs fjernvarme. */
  electricCostSharePct: number;
  heatCostSharePct: number;
  marginalPriceSpreadKr: { min: number; max: number; p50: number };
  avgControllableElectricKwBaseline: number;
  avgControllableElectricKwMpc: number;
  avgControllableHeatKwBaseline: number;
  avgControllableHeatKwMpc: number;
  explanations: string[];
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx] ?? sorted[0]!;
}

export function analyzeReplayCostDelta(input: {
  steps: readonly MpcReplayStep[];
  summary: {
    totalCostBaselineKr: number;
    totalCostMpcKr: number;
    totalCostEmulatedKr?: number | null;
    deltaCostKr: number;
    deltaCostPct: number;
    deltaCostVsEmulatedKr?: number | null;
    meaningfulDeltaPct?: number;
    mpcVsObservedDeltaPct?: number;
    stepCount: number;
  };
}): ReplayCostDiagnosis {
  const steps = input.steps;
  const meaningfulDeltaPct =
    input.summary.mpcVsObservedDeltaPct ??
    input.summary.meaningfulDeltaPct ??
    0;
  let elBase = 0;
  let heatBase = 0;
  let highMoveLowSave = 0;
  const marginals: number[] = [];
  let elKwBaseSum = 0;
  let elKwMpcSum = 0;
  let heatKwBaseSum = 0;
  let heatKwMpcSum = 0;
  let counted = 0;

  for (const step of steps) {
    const marginal = step.marginalKrPerKwh;
    if (marginal != null && Number.isFinite(marginal)) marginals.push(marginal);

    const elKwhBase = step.proxyElKwhBaseline ?? 0;
    const elKwhMpc = step.proxyElKwhMpc ?? 0;
    const htKwhBase = step.proxyHeatKwhBaseline ?? 0;
    const htKwhMpc = step.proxyHeatKwhMpc ?? 0;

    const elCostBase = elKwhBase * (marginal ?? 0);
    const htCostBase = step.costBaselineKr - elCostBase;
    elBase += elCostBase;
    heatBase += Math.max(0, htCostBase);

    const stepHours = 0.25;
    elKwBaseSum += elKwhBase / stepHours;
    elKwMpcSum += elKwhMpc / stepHours;
    heatKwBaseSum += htKwhBase / stepHours;
    heatKwMpcSum += htKwhMpc / stepHours;
    counted += 1;

    const move =
      step.uBmsMeas != null &&
      controlVectorNormSq(deltaControlVectors(step.uMpc, step.uBmsMeas)) >
        MEANINGFUL_DELTA_NORM_SQ;
    const save = step.costBaselineKr - step.costMpcKr;
    if (move && save <= 0.01) highMoveLowSave += 1;
  }

  const totalDecomposed = elBase + heatBase;
  const sortedMarginals = marginals.toSorted((a, b) => a - b);
  const explanations: string[] = [];

  const emulated = input.summary.totalCostEmulatedKr ?? null;
  const deltaEm = input.summary.deltaCostVsEmulatedKr ?? null;

  if (input.summary.stepCount > 650) {
    explanations.push(
      `Eval-vinduet har ${input.summary.stepCount} steg (~${Math.round(input.summary.stepCount / 96)} dager) — uten --no-clip-eval kan tidlige timer med lav SD-dekning øke steg uten mer optimaliseringsrom.`,
    );
  }

  if (Math.abs(input.summary.deltaCostPct) < 0.15) {
    explanations.push(
      `Δ kost ${input.summary.deltaCostKr} kr (${input.summary.deltaCostPct} %) er innenfor avrundingsstøy — kontrollerbar last er liten (${input.summary.totalCostBaselineKr} kr total proxy-kost over perioden).`,
    );
  }

  if (deltaEm != null && Math.abs(deltaEm) < 0.1) {
    explanations.push(
      `MPC og emulert BMS har nesten identisk kost (${input.summary.totalCostMpcKr} vs ${emulated} kr) — optimalisereren finner lite pris-forskyvning utover baseline-emulatoren.`,
    );
  }

  if (meaningfulDeltaPct > 25 && Math.abs(input.summary.deltaCostPct) < 1) {
    explanations.push(
      `${meaningfulDeltaPct} % av steg har meningsfull δu, men strøm-proxyen oversetter lite til kWh — typisk når vifte/endring er moderat eller prisspredning er lav.`,
    );
  }

  if (highMoveLowSave > steps.length * 0.2) {
    explanations.push(
      `${highMoveLowSave} steg har stor kontrollendring men ≤ 0,01 kr besparelse — λ_move kan dominere over energikost i objektivet.`,
    );
  }

  const spread =
    sortedMarginals.length > 0
      ? {
          min: Math.round(sortedMarginals[0]! * 1000) / 1000,
          max: Math.round(sortedMarginals.at(-1)! * 1000) / 1000,
          p50: Math.round(percentile(sortedMarginals, 0.5) * 1000) / 1000,
        }
      : { min: 0, max: 0, p50: 0 };

  if (spread.max - spread.min < 0.15) {
    explanations.push(
      `Lav prisspredning (marginal ${spread.min}–${spread.max} kr/kWh) begrenser load-shift-gevinster.`,
    );
  }

  return {
    stepCount: input.summary.stepCount,
    evalDaysApprox: Math.round((input.summary.stepCount / 96) * 10) / 10,
    totalCostBaselineKr: input.summary.totalCostBaselineKr,
    totalCostMpcKr: input.summary.totalCostMpcKr,
    totalCostEmulatedKr: emulated,
    deltaCostKr: input.summary.deltaCostKr,
    deltaCostPct: input.summary.deltaCostPct,
    deltaCostVsEmulatedKr: deltaEm,
    meaningfulDeltaPct,
    highMoveLowSaveSteps: highMoveLowSave,
    electricCostSharePct:
      totalDecomposed > 0
        ? Math.round((elBase / totalDecomposed) * 1000) / 10
        : 0,
    heatCostSharePct:
      totalDecomposed > 0
        ? Math.round((heatBase / totalDecomposed) * 1000) / 10
        : 0,
    marginalPriceSpreadKr: spread,
    avgControllableElectricKwBaseline:
      counted > 0 ? Math.round((elKwBaseSum / counted) * 100) / 100 : 0,
    avgControllableElectricKwMpc:
      counted > 0 ? Math.round((elKwMpcSum / counted) * 100) / 100 : 0,
    avgControllableHeatKwBaseline:
      counted > 0 ? Math.round((heatKwBaseSum / counted) * 100) / 100 : 0,
    avgControllableHeatKwMpc:
      counted > 0 ? Math.round((heatKwMpcSum / counted) * 100) / 100 : 0,
    explanations,
  };
}
