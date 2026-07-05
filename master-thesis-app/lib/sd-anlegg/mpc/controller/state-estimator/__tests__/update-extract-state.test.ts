import { describe, expect, it } from "bun:test";
import { updateExtractState } from "@/lib/sd-anlegg/mpc/controller/state-estimator/extract-blend";

describe("updateExtractState", () => {
  it("returnerer prediksjon uten måling", () => {
    expect(
      updateExtractState({
        measuredC: null,
        predictedC: 22,
        previousC: 20,
        blendAlpha: 0.5,
      }),
    ).toBe(22);
  });

  it("blender måling og prediksjon", () => {
    expect(
      updateExtractState({
        measuredC: 24,
        predictedC: 22,
        previousC: 20,
        blendAlpha: 0.5,
      }),
    ).toBe(23);
  });

  it("α=1 gir ren måling", () => {
    expect(
      updateExtractState({
        measuredC: 24,
        predictedC: 22,
        previousC: 20,
        blendAlpha: 1,
      }),
    ).toBe(24);
  });
});
