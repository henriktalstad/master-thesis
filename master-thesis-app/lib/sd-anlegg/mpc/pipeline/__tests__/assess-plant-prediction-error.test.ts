import { describe, expect, it } from "bun:test";
import {
  assessPlantPredictionBounded,
  PLANT_RMSE_COMFORT_BAND_MAX_SHARE,
} from "@/lib/sd-anlegg/mpc/pipeline/assess-plant-prediction-error";

describe("assessPlantPredictionBounded", () => {
  const band = { min: 18, max: 24 };

  it("markerer bounded når RMSE er liten relativt til komfortband", () => {
    const result = assessPlantPredictionBounded({ rmseC: 1.0, comfortBandC: band });
    expect(result?.bounded).toBe(true);
    expect(result?.rmseShareOfBand).toBeCloseTo(1 / 6, 3);
    expect(result?.blockerMessage).toBeNull();
  });

  it("flagger når RMSE overstiger terskel", () => {
    const result = assessPlantPredictionBounded({ rmseC: 2.0, comfortBandC: band });
    expect(result?.bounded).toBe(false);
    expect(result?.blockerMessage).toContain("Kuvert-RMSE");
  });

  it("returnerer null uten gyldig RMSE", () => {
    expect(assessPlantPredictionBounded({ rmseC: null, comfortBandC: band })).toBeNull();
  });

  it("eksporterer default terskel for dokumentasjon", () => {
    expect(PLANT_RMSE_COMFORT_BAND_MAX_SHARE).toBe(0.25);
  });
});
