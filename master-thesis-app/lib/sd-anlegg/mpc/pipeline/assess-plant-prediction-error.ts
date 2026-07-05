/** Max holdout RMSE as share of comfort band width before MPC planning is flagged. */
export const PLANT_RMSE_COMFORT_BAND_MAX_SHARE = 0.25;

export type ComfortBandC = { min: number; max: number };

export type PlantPredictionBoundedAssessment = {
  rmseC: number;
  comfortBandWidthC: number;
  rmseShareOfBand: number;
  bounded: boolean;
  blockerMessage: string | null;
};

export function comfortBandWidthC(band: ComfortBandC): number {
  return Math.max(0, band.max - band.min);
}

/**
 * ISS-inspired check: treat plant prediction error as a bounded disturbance
 * relative to the comfort constraint width (Seel et al., ACC 2021).
 */
export function assessPlantPredictionBounded(input: {
  rmseC: number | null | undefined;
  comfortBandC: ComfortBandC;
  maxRmseShareOfBand?: number;
}): PlantPredictionBoundedAssessment | null {
  if (input.rmseC == null || !Number.isFinite(input.rmseC)) return null;

  const width = comfortBandWidthC(input.comfortBandC);
  if (width <= 0) return null;

  const maxShare = input.maxRmseShareOfBand ?? PLANT_RMSE_COMFORT_BAND_MAX_SHARE;
  const rmseShareOfBand = input.rmseC / width;
  const bounded = rmseShareOfBand <= maxShare;

  return {
    rmseC: input.rmseC,
    comfortBandWidthC: width,
    rmseShareOfBand: Math.round(rmseShareOfBand * 1000) / 1000,
    bounded,
    blockerMessage: bounded
      ? null
      : `Kuvert-RMSE ${input.rmseC.toFixed(2)} °C (${Math.round(rmseShareOfBand * 100)} % av komfortband) — prediksjonsfeil høy relativt til komfortmargin`,
  };
}
