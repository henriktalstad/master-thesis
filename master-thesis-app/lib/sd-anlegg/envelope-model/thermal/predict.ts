import { predictLinear } from "../lib/linear-regression";
import { plantModelToLinear } from "./fit-plant";
import { heatRecoveryStateToLinear } from "./fit-heat-recovery-state";
import { buildPlantFeatureVector } from "./build-features";
import type {
  MpcControlVector,
  MpcTimestep,
  PlantModelParams,
} from "@/lib/sd-anlegg/mpc/shared/types";

export function predictExtractTemperature(input: {
  params: PlantModelParams;
  tExtPrev: number;
  tRecPrev?: number | null;
  u: MpcControlVector;
  step: MpcTimestep;
}): number | null {
  const features = buildPlantFeatureVector(input.params.featureNames, {
    tExtPrev: input.tExtPrev,
    tRecPrev: input.tRecPrev,
    u: input.u,
    step: input.step,
  });
  if (!features) return null;
  return predictLinear(features, plantModelToLinear(input.params));
}

/**
 * Andre RC-tilstand — varmegjenvinner etter-temp. Krever egen forrige
 * tilstand (tRecPrev) i tillegg til extractTemp-tilstanden (t_ext_prev),
 * slik at de to modellene sammen utgjør et koblet 2-tilstands system.
 */
export function predictHeatRecoveryAfterTemp(input: {
  params: PlantModelParams;
  tExtPrev: number;
  tRecPrev: number;
  u: MpcControlVector;
  step: MpcTimestep;
}): number | null {
  const secondary = input.params.heatRecoveryState;
  if (!secondary) return null;
  const features = buildPlantFeatureVector(secondary.featureNames, {
    tExtPrev: input.tExtPrev,
    tRecPrev: input.tRecPrev,
    u: input.u,
    step: input.step,
  });
  if (!features) return null;
  return predictLinear(features, heatRecoveryStateToLinear(secondary));
}
