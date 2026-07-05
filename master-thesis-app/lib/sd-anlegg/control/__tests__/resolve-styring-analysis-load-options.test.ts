import { describe, expect, test } from "bun:test";
import { resolveStyringAnalysisLoadOptions } from "@/lib/sd-anlegg/control/resolve-styring-analysis-load-options";

describe("resolveStyringAnalysisLoadOptions", () => {
  test("signaler henter full replay uten tunge analyse-artifacts", () => {
    expect(resolveStyringAnalysisLoadOptions("signaler")).toEqual({
      includeFullReplaySteps: true,
      skipAnalysisArtifacts: true,
    });
  });

  test("oversikt og pris bruker tail + materialiserte artifacts", () => {
    expect(resolveStyringAnalysisLoadOptions("oversikt")).toEqual({
      includeFullReplaySteps: false,
      skipAnalysisArtifacts: false,
      tailStepCount: 96,
    });
    expect(resolveStyringAnalysisLoadOptions("pris")).toEqual({
      includeFullReplaySteps: false,
      skipAnalysisArtifacts: false,
      tailStepCount: 96,
    });
  });

  test("energi trenger full replay for reconcile", () => {
    expect(resolveStyringAnalysisLoadOptions("energi")).toEqual({
      includeFullReplaySteps: true,
      skipAnalysisArtifacts: false,
    });
  });
});
