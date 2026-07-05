import {
  resolveCoolingValveFeedbackObjectId,
} from "@/lib/sd-anlegg/control/resolve-cooling-valve-pct";
import {
  normalizeEvalValveSamplePct,
  type EvalValvePointMeta,
} from "./normalize-eval-valve-sample";

export { resolveCoolingValveFeedbackObjectId };

export function readCoolingValveSampleValues(input: {
  t: string;
  sampleMaps: ReadonlyMap<string, ReadonlyMap<string, number>>;
  commandObjectId: string | null;
  feedbackObjectId: string | null;
  commandPoint?: EvalValvePointMeta | null;
  feedbackPoint?: EvalValvePointMeta | null;
  outdoorTempC: number | null;
}): {
  coolingValveCommandPct?: number;
  coolingValveFeedbackPct?: number;
  outdoorTempC: number | null;
} {
  const values: {
    coolingValveCommandPct?: number;
    coolingValveFeedbackPct?: number;
    outdoorTempC: number | null;
  } = { outdoorTempC: input.outdoorTempC };

  if (input.commandObjectId) {
    const cmd = input.sampleMaps.get(input.commandObjectId)?.get(input.t);
    if (cmd != null) {
      values.coolingValveCommandPct =
        input.commandPoint != null
          ? normalizeEvalValveSamplePct(
              "cooling.valve.command",
              cmd,
              input.commandPoint,
            )
          : cmd;
    }
  }
  if (input.feedbackObjectId) {
    const fb = input.sampleMaps.get(input.feedbackObjectId)?.get(input.t);
    if (fb != null) {
      values.coolingValveFeedbackPct =
        input.feedbackPoint != null
          ? normalizeEvalValveSamplePct(
              "cooling.valve.position",
              fb,
              input.feedbackPoint,
            )
          : fb;
    }
  }
  return values;
}
