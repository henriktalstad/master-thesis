import type { InfraspawnPointHaystackInput } from "@/lib/infraspawn/point-haystack";
import { infraspawnPointHaystack } from "@/lib/infraspawn/point-haystack";
import type { SdComponentCategory, SdComponentType } from "./component-types";

export type SdComponentMatchRule = {
  pattern: RegExp;
  weight?: number;
};

export type SdComponentDefinition = {
  type: SdComponentType;
  label: string;
  category: SdComponentCategory;
  defaultSize: { width: number; height: number };
  maxBindings: number;
  matchRules: SdComponentMatchRule[];
};

export const SD_COMPONENT_REGISTRY: SdComponentDefinition[] = [
  {
    type: "ventilation.fan",
    label: "Vifte",
    category: "ventilation",
    defaultSize: { width: 120, height: 72 },
    maxBindings: 2,
    matchRules: [
      { pattern: /\bJV\d+/i, weight: 4 },
      { pattern: /supply.*fan|extract.*fan|tilluft.*vifte|avtrekk.*vifte/i, weight: 3 },
      { pattern: /_saf|_eaf|fan/i, weight: 2 },
    ],
  },
  {
    type: "ventilation.damper",
    label: "Spjeld",
    category: "ventilation",
    defaultSize: { width: 96, height: 56 },
    maxBindings: 1,
    matchRules: [
      { pattern: /\bKA\d+/i, weight: 4 },
      { pattern: /damper|spjeld|lukket|lukke/i, weight: 3 },
    ],
  },
  {
    type: "ventilation.filter",
    label: "Filter",
    category: "ventilation",
    defaultSize: { width: 96, height: 56 },
    maxBindings: 1,
    matchRules: [
      { pattern: /\bQD\d+/i, weight: 4 },
      { pattern: /filter|filtre/i, weight: 3 },
    ],
  },
  {
    type: "ventilation.heat_recovery",
    label: "Varmegjenvinner",
    category: "ventilation",
    defaultSize: { width: 120, height: 80 },
    maxBindings: 2,
    matchRules: [
      { pattern: /\bLX\d+/i, weight: 4 },
      { pattern: /vvx|heat.?recovery|varmegjenvinner/i, weight: 3 },
    ],
  },
  {
    type: "sensor.temperature",
    label: "Temperatur",
    category: "sensor",
    defaultSize: { width: 104, height: 56 },
    maxBindings: 1,
    matchRules: [
      { pattern: /\bRT\d+/i, weight: 4 },
      { pattern: /turtemp|returtemp|turvann|returvann|utetemp|temperatur|temperature/i, weight: 3 },
      { pattern: /_sp\b|setpunkt/i, weight: 2 },
      { pattern: /degree|celsius|°c/i, weight: 1 },
    ],
  },
  {
    type: "sensor.pressure",
    label: "Trykk",
    category: "sensor",
    defaultSize: { width: 104, height: 56 },
    maxBindings: 1,
    matchRules: [
      { pattern: /\bRP\d+/i, weight: 4 },
      { pattern: /differansetrykk|pressure|trykk|pascal/i, weight: 3 },
      { pattern: /_eaf|_saf/i, weight: 2 },
    ],
  },
  {
    type: "hvac.pump",
    label: "Pumpe",
    category: "heating",
    defaultSize: { width: 104, height: 64 },
    maxBindings: 1,
    matchRules: [
      { pattern: /\bJP\d+/i, weight: 4 },
      { pattern: /pumpe|pump/i, weight: 3 },
    ],
  },
  {
    type: "hvac.valve",
    label: "Ventil",
    category: "heating",
    defaultSize: { width: 96, height: 56 },
    maxBindings: 1,
    matchRules: [
      { pattern: /\bSB\d+/i, weight: 4 },
      { pattern: /ventil|valve/i, weight: 3 },
    ],
  },
  {
    type: "binary.status",
    label: "Status",
    category: "binary",
    defaultSize: { width: 96, height: 48 },
    maxBindings: 1,
    matchRules: [
      { pattern: /alarm|fault|feil|brann|status|frostvakt|tidsprogram/i, weight: 3 },
    ],
  },
  {
    type: "generic.signal",
    label: "Signal",
    category: "generic",
    defaultSize: { width: 104, height: 48 },
    maxBindings: 1,
    matchRules: [
      { pattern: /OE00\d_(flow|volum|energi|effekt)/i, weight: 4 },
      { pattern: /3200\d*oe00\d_(flow|volum|energi|effekt)/i, weight: 4 },
      { pattern: /_(flow|volum|energi|effekt)\b/i, weight: 3 },
      { pattern: /effekt|flow|volum|energi akkumulert/i, weight: 3 },
      { pattern: /OE00\d/i, weight: 2 },
    ],
  },
];

export function getSdComponentDefinition(
  type: SdComponentType,
): SdComponentDefinition | undefined {
  return SD_COMPONENT_REGISTRY.find((entry) => entry.type === type);
}

export function scoreSdComponentMatch(
  definition: SdComponentDefinition,
  input: InfraspawnPointHaystackInput,
): number {
  const haystack = infraspawnPointHaystack(input);
  let score = 0;
  for (const rule of definition.matchRules) {
    if (rule.pattern.test(haystack)) {
      score += rule.weight ?? 1;
    }
  }
  return score;
}
