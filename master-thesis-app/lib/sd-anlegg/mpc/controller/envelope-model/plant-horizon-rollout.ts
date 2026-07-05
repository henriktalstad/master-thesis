import {
  predictExtractTemperature,
  predictHeatRecoveryAfterTemp,
} from "@/lib/sd-anlegg/mpc/controller/envelope-model/fit-plant-model";
import type {
  MpcControlVector,
  MpcTimestep,
  PlantModelParams,
} from "@/lib/sd-anlegg/mpc/shared/types";

export type PlantHorizonState = {
  tExt: number;
  tRec: number | null;
};

export function advancePlantHorizonState(input: {
  plant: PlantModelParams;
  state: PlantHorizonState;
  u: MpcControlVector;
  step: MpcTimestep;
}): {
  state: PlantHorizonState;
  extractPred: number | null;
  heatRecoveryPred: number | null;
} {
  const { plant, u, step } = input;
  let { tExt, tRec } = input.state;

  const extractPred = predictExtractTemperature({
    params: plant,
    tExtPrev: tExt,
    tRecPrev: tRec,
    u,
    step,
  });

  let heatRecoveryPred: number | null = null;
  if (plant.heatRecoveryState != null && tRec != null) {
    heatRecoveryPred = predictHeatRecoveryAfterTemp({
      params: plant,
      tExtPrev: tExt,
      tRecPrev: tRec,
      u,
      step,
    });
  }

  if (extractPred != null) tExt = extractPred;
  if (heatRecoveryPred != null) tRec = heatRecoveryPred;

  return {
    state: { tExt, tRec },
    extractPred,
    heatRecoveryPred,
  };
}
