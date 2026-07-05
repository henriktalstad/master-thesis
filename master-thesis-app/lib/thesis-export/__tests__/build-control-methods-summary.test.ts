import { describe, expect, it } from "bun:test";
import {
  buildControlMethodsSummary,
  formatControlMethodsSummaryLatex,
} from "../build-control-methods-summary";

describe("buildControlMethodsSummary", () => {
  it("samler policies og tuning", () => {
    const summary = buildControlMethodsSummary({
      policyComparison: {
        evalStart: "2026-06-24T00:00:00.000Z",
        policies: [
          {
            policyId: "mpc-v1",
            label: "Simulert MPC",
            claimLevel: "simulated",
            totalCostKr: 36.45,
            deltaCostVsObservedPct: 0,
            comfortViolations: 244,
          },
        ],
      },
      tuningReport: {
        recommendedPresetId: "anlegg_pris_respons_v1",
        results: [
          {
            presetId: "anlegg_pris_respons_v1",
            label: "Anlegg pris respons v1",
            solver: { lambdaComfort: 1.5, lambdaMove: 0.03, lambdaPeak: 0.18 },
            summary: { deltaCostVsEmulatedPct: 0, comfortViolationsMpc: 244 },
            meaningfulDeltaPct: 12,
          },
        ],
      },
    });

    expect(summary.controlPolicies).toHaveLength(1);
    expect(summary.mpcTuningPresets[0]?.recommended).toBe(true);
    expect(summary.mpcTuningPresets[0]?.lambdaComfort).toBe(1.5);
  });

  it("genererer LaTeX-tabeller", () => {
    const summary = buildControlMethodsSummary({
      policyComparison: {
        policies: [
          {
            policyId: "observed",
            label: "Observert",
            claimLevel: "observed",
            comfortViolations: 282,
          },
        ],
      },
    });
    const tex = formatControlMethodsSummaryLatex(summary);
    expect(tex).toContain("\\label{tab:generated_policy_comparison}");
    expect(tex).toContain("Measured");
  });
});
