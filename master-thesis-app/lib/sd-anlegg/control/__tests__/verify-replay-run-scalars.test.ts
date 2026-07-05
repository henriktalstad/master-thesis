import { describe, expect, test } from "bun:test";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { summarizeMpcReplaySteps } from "../summarize-mpc-replay-steps";
import { verifyReplayRunScalars } from "../verify-replay-run-scalars";

function step(t: string, overrides: Partial<MpcReplayStep> = {}): MpcReplayStep {
  return {
    t,
    uBmsMeas: {
      supplySetpointC: 18,
      supplyFanPct: 40,
      exhaustFanPct: 35,
      heatingValvePct: 0,
      coolingValvePct: 0,
    },
    uBmsSim: {
      supplySetpointC: 18,
      supplyFanPct: 38,
      exhaustFanPct: 33,
      heatingValvePct: 0,
      coolingValvePct: 0,
    },
    uMpc: {
      supplySetpointC: 18,
      supplyFanPct: 36,
      exhaustFanPct: 32,
      heatingValvePct: 0,
      coolingValvePct: 0,
    },
    costBaselineKr: 1.2,
    costEmulatedKr: 1.1,
    costMpcKr: 1.05,
    costDemandKr: 1.08,
    marginalKrPerKwh: 1.2,
    proxyElKwhBaseline: 0.5,
    proxyElKwhEmulated: 0.48,
    proxyElKwhMpc: 0.45,
    proxyHeatKwhBaseline: 0.2,
    proxyHeatKwhEmulated: 0.19,
    proxyHeatKwhMpc: 0.18,
    extractTempMeasC: 21,
    extractTempPredC: 21.1,
    comfortBandMinC: 18,
    comfortBandMaxC: 24,
    comfortViolation: false,
    comfortViolationEmulated: false,
    usedFallback: false,
    ...overrides,
  } as MpcReplayStep;
}

describe("verifyReplayRunScalars", () => {
  test("passer når persisterte scalars matcher summarizeMpcReplaySteps", () => {
    const steps = [
      step("2026-06-24T10:00:00.000Z"),
      step("2026-06-24T10:15:00.000Z"),
    ];
    const summary = summarizeMpcReplaySteps(steps)!;

    const result = verifyReplayRunScalars({
      steps,
      persisted: {
        stepCount: summary.stepCount,
        totalCostBaselineKr: summary.totalCostBaselineKr,
        totalCostEmulatedKr: summary.totalCostEmulatedKr,
        totalCostMpcKr: summary.totalCostMpcKr,
        totalCostDemandKr: summary.totalCostDemandKr,
        deltaCostKr: summary.deltaCostKr,
        deltaCostPct: summary.deltaCostPct,
        deltaCostVsEmulatedKr: summary.deltaCostVsEmulatedKr,
        deltaCostVsEmulatedPct: summary.deltaCostVsEmulatedPct,
        peakElectricKwBaseline: summary.peakElectricKwBaseline,
        peakElectricKwEmulated: summary.peakElectricKwEmulated,
        peakElectricKwMpc: summary.peakElectricKwMpc,
        controllableElectricKwhBaseline: summary.controllableElectricKwhBaseline,
        controllableElectricKwhEmulated: summary.controllableElectricKwhEmulated,
        controllableElectricKwhMpc: summary.controllableElectricKwhMpc,
        controllableHeatKwhBaseline: summary.controllableHeatKwhBaseline,
        controllableHeatKwhEmulated: summary.controllableHeatKwhEmulated,
        controllableHeatKwhMpc: summary.controllableHeatKwhMpc,
        comfortViolationsMpc: summary.comfortViolationsMpc,
        comfortViolationsBaseline: summary.comfortViolationsBaseline,
        comfortViolationsEmulated: summary.comfortViolationsEmulated,
        comfortViolationsDemand: summary.comfortViolationsDemand,
        fallbackSteps: summary.fallbackSteps,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  test("feiler når totalCostMpcKr avviker", () => {
    const steps = [step("2026-06-24T10:00:00.000Z")];
    const summary = summarizeMpcReplaySteps(steps)!;

    const result = verifyReplayRunScalars({
      steps,
      persisted: {
        stepCount: summary.stepCount,
        totalCostMpcKr: summary.totalCostMpcKr + 5,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.startsWith("totalCostMpcKr:"))).toBe(true);
  });
});
