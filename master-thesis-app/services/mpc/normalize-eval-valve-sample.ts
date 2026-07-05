import {
  mapValveCommandChartSampleValue,
  type InfraspawnValveCommandInput,
} from "@/lib/sd-anlegg/valve-command-percent";

const EVAL_VALVE_CANONICALS = new Set([
  "heating.valve.command",
  "cooling.valve.command",
  "cooling.valve.position",
]);

export type EvalValvePointMeta = Pick<
  InfraspawnValveCommandInput,
  "objectId" | "objectName" | "description" | "unit" | "lastValue"
>;
export function normalizeEvalValveSamplePct(
  canonicalId: string,
  rawValue: number,
  point: EvalValvePointMeta,
): number {
  if (!EVAL_VALVE_CANONICALS.has(canonicalId)) return rawValue;
  return mapValveCommandChartSampleValue(rawValue, point) ?? rawValue;
}
