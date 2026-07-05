import type { CapacityTariffAnalysis } from "./build-capacity-tariff-analysis";
import { loadProfileMissingPeakFields } from "./build-capacity-tariff-analysis";
import type { PriceLoadShiftAnalysis } from "./build-price-load-shift-analysis";
import { buildMpcReplayLoadProfile } from "./build-mpc-replay-profiles";
import {
  summarizeExtractComfortMae,
  buildMpcComfortSeries,
  type ExtractComfortMae,
} from "./summarize-comfort";
import type { MpcReplayStep, MpcReplayResult } from "@/lib/sd-anlegg/mpc/shared/types";

export type MpcReplaySummaryVerificationSlice = Partial<
  Pick<
    MpcReplayResult["summary"],
    "mpcVsObservedDeltaPct" | "meaningfulDeltaPct" | "fallbackPct" | "deltaCostPct"
  >
>;

export type MpcReplayVerificationHealth = "pass" | "warn" | "fail";

export type MpcReplayVerification = {
  generatedAt: string;
  evalStart: string | null;
  evalEnd: string | null;
  stepCount: number;
  health: MpcReplayVerificationHealth;
  failures: string[];
  warnings: string[];
  peakFields: {
    needsRerun: boolean;
    observedKwSteps: number;
    peakObservedHours: number;
    peakEmulatedHours: number;
    peakMpcHours: number;
  };
  comfort: ExtractComfortMae & {
    violationStepsMpc: number;
    violationStepsEmulated: number;
  };
  priceLoad: {
    present: boolean;
    deltaE_hp_kwh: number | null;
    highPriceHours: number | null;
  };
  capacity: {
    present: boolean;
    missingTariffMonths: string[];
    hasCapacityLink: boolean;
    evalPeakMpcKw: number | null;
    evalPeakEmulatedKw: number | null;
  };
  replaySummary: {
    mpcVsObservedDeltaPct: number | null;
    meaningfulDeltaPct: number | null;
    fallbackPct: number | null;
    deltaCostPct: number | null;
  };
};

function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.round((n / d) * 1000) / 10;
}

export function buildMpcReplayVerification(input: {
  steps: readonly MpcReplayStep[];
  evalStart?: string | null;
  evalEnd?: string | null;
  priceLoadShift?: PriceLoadShiftAnalysis | null;
  capacityTariff?: CapacityTariffAnalysis | null;
  replaySummary?: MpcReplaySummaryVerificationSlice | null;
}): MpcReplayVerification {
  const steps = input.steps;
  const failures: string[] = [];
  const warnings: string[] = [];

  const loadProfile = buildMpcReplayLoadProfile(steps);
  const needsRerun = loadProfileMissingPeakFields(loadProfile);
  const peakFields = {
    needsRerun,
    observedKwSteps: steps.filter(
      (s) => s.uBmsMeas != null || s.proxyElKwhBaseline != null,
    ).length,
    peakObservedHours: loadProfile.filter((p) => p.peakObservedKw != null).length,
    peakEmulatedHours: loadProfile.filter((p) => p.peakEmulatedKw != null).length,
    peakMpcHours: loadProfile.filter((p) => p.peakMpcKw != null).length,
  };

  if (steps.length === 0) failures.push("Ingen replay-steg");
  if (needsRerun) {
    failures.push("LoadProfile mangler peak*Kw — kjør replay på nytt");
  }
  if (peakFields.observedKwSteps === 0 && steps.length > 0) {
    warnings.push("Ingen steg med observedKw i replay");
  }

  const comfortMae = summarizeExtractComfortMae(steps);
  const comfortSeries = buildMpcComfortSeries(steps);
  const comfort = {
    ...comfortMae,
    violationStepsMpc: comfortSeries.filter((p) => p.comfortViolationMpc).length,
    violationStepsEmulated: comfortSeries.filter((p) => p.comfortViolationEmulated)
      .length,
  };

  if (comfortMae.comparedSteps === 0 && steps.length > 0) {
    warnings.push("Ingen avtrekk for MAE-beregning");
  }

  const priceLoad = input.priceLoadShift;
  const priceLoadBlock = {
    present: priceLoad != null,
    deltaE_hp_kwh: priceLoad?.deltaE_hp_kwh ?? null,
    highPriceHours: priceLoad?.highPriceHours ?? null,
  };
  if (!priceLoad && steps.length > 0) {
    warnings.push("Mangler priceLoadShift-analyse");
  }

  const capacity = input.capacityTariff;
  const hasCapacityLink =
    capacity?.monthlyRows.some((r) => r.capacityLinkKrPerKw != null) ?? false;
  const capacityBlock = {
    present: capacity != null,
    missingTariffMonths: capacity?.missingTariffMonths ?? [],
    hasCapacityLink,
    evalPeakMpcKw: capacity?.evalPeakKw.mpc ?? null,
    evalPeakEmulatedKw: capacity?.evalPeakKw.emulated ?? null,
  };

  if (capacity?.missingTariffMonths.length) {
    warnings.push(
      `Mangler NVE-nettleie: ${capacity.missingTariffMonths.join(", ")}`,
    );
  }
  if (capacity && !hasCapacityLink) {
    warnings.push("Ingen capacityLink — velg nettoperatør og synk nettleie");
  }

  const rs = input.replaySummary;
  const replaySummary = {
    mpcVsObservedDeltaPct: rs?.mpcVsObservedDeltaPct ?? null,
    meaningfulDeltaPct: rs?.meaningfulDeltaPct ?? null,
    fallbackPct:
      rs?.fallbackPct ??
      (steps.length > 0
        ? pct(steps.filter((s) => s.usedFallback).length, steps.length)
        : null),
    deltaCostPct: rs?.deltaCostPct ?? null,
  };

  if (
    priceLoad?.deltaE_hp_pct != null &&
    replaySummary.mpcVsObservedDeltaPct != null &&
    replaySummary.mpcVsObservedDeltaPct > 10 &&
    Math.abs(priceLoad.deltaE_hp_pct) < 1
  ) {
    warnings.push(
      "Høy styring-avvik mot observert, men minimal høypris-flytting — proxy kan være prisufølsom",
    );
  }

  let health: MpcReplayVerificationHealth = "pass";
  if (failures.length > 0) health = "fail";
  else if (warnings.length > 0) health = "warn";

  return {
    generatedAt: new Date().toISOString(),
    evalStart: input.evalStart ?? null,
    evalEnd: input.evalEnd ?? null,
    stepCount: steps.length,
    health,
    failures,
    warnings,
    peakFields,
    comfort,
    priceLoad: priceLoadBlock,
    capacity: capacityBlock,
    replaySummary,
  };
}
