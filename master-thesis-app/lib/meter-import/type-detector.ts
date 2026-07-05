import type { MeteringPointType } from "@/generated/client";


export interface TypeDetectionResult {
  type: MeteringPointType;
  confidence: number; // 0-1
  source: "exact" | "pattern" | "fallback";
  matchedPattern?: string;
}


const EXACT_TYPE_MAP: Record<string, MeteringPointType> = {
  strøm: "ELECTRICITY",
  elektrisitet: "ELECTRICITY",
  elektrisk: "ELECTRICITY",
  el: "ELECTRICITY",
  kraft: "ELECTRICITY",
  strom: "ELECTRICITY", // uten ø
  fjernvarme: "HEAT",
  varme: "HEAT",
  "termisk varme": "HEAT",
  termisk: "HEAT",
  kjøling: "COOLING",
  kjoling: "COOLING",
  "termisk kjøling": "COOLING",
  "termisk kjoling": "COOLING",
  fjernkjøling: "COOLING",
  fjernkjoling: "COOLING",
  produksjon: "PRODUCTION",
  energiproduksjon: "PRODUCTION",
  solenergi: "PRODUCTION",
  solcelle: "PRODUCTION",
  vann: "WATER",
  vannforbruk: "WATER",

  electricity: "ELECTRICITY",
  electric: "ELECTRICITY",
  power: "ELECTRICITY",
  heat: "HEAT",
  heating: "HEAT",
  "district heating": "HEAT",
  "district heat": "HEAT",
  "thermal heat": "HEAT",
  cooling: "COOLING",
  chiller: "COOLING",
  "thermal cooling": "COOLING",
  "district cooling": "COOLING",
  production: "PRODUCTION",
  solar: "PRODUCTION",
  pv: "PRODUCTION",
  water: "WATER",
};

const TYPE_PATTERNS: { pattern: RegExp; type: MeteringPointType }[] = [
  { pattern: /\bstr[øo]m/i, type: "ELECTRICITY" },
  { pattern: /\belektr/i, type: "ELECTRICITY" },
  { pattern: /\bkwh\s*(el|strøm)/i, type: "ELECTRICITY" },
  { pattern: /\bel[-.\s]?m[åa]l/i, type: "ELECTRICITY" },
  { pattern: /\bhovedt?avle/i, type: "ELECTRICITY" }, // Hovedtavle → strøm
  { pattern: /\bfordeling\s*\d/i, type: "ELECTRICITY" }, // Fordeling 433.201
  { pattern: /\bstikkontakt/i, type: "ELECTRICITY" },

  { pattern: /\bfjernvarm/i, type: "HEAT" },
  { pattern: /\btermisk\s+varm/i, type: "HEAT" },
  { pattern: /\bvarmesent?ral/i, type: "HEAT" },
  { pattern: /\bgulvvarm/i, type: "HEAT" },
  { pattern: /\bradiator/i, type: "HEAT" },
  { pattern: /\bvarmt?\s*vann/i, type: "HEAT" },
  { pattern: /\bvvb\b/i, type: "HEAT" },
  { pattern: /\bvarmepumpe/i, type: "HEAT" },
  { pattern: /\boppvarming/i, type: "HEAT" },

  { pattern: /\bkj[øo]l/i, type: "COOLING" },
  { pattern: /\btermisk\s+kj[øo]l/i, type: "COOLING" },
  { pattern: /\bchill/i, type: "COOLING" },
  { pattern: /\bt[øo]rrk[jy][øo]l/i, type: "COOLING" },
  { pattern: /\bfree\s*cool/i, type: "COOLING" },

  { pattern: /\bsolcelle/i, type: "PRODUCTION" },
  { pattern: /\bsol\s*panel/i, type: "PRODUCTION" },
  { pattern: /\bpv\s*anlegg/i, type: "PRODUCTION" },
  { pattern: /\bvindkraft/i, type: "PRODUCTION" },
  { pattern: /\bvindturbin/i, type: "PRODUCTION" },
  { pattern: /\bproduksjon/i, type: "PRODUCTION" },
  { pattern: /\binverter/i, type: "PRODUCTION" },

  { pattern: /\bvann(?!.*varm)/i, type: "WATER" },
  { pattern: /\bkaldtvann/i, type: "WATER" },
  { pattern: /\bwater(?!.*heat)/i, type: "WATER" },
  { pattern: /\bm[³3]\b/i, type: "WATER" },
  { pattern: /\bvannm[åa]l/i, type: "WATER" },
];


export function detectMeterType(
  rawType: string | null | undefined,
): TypeDetectionResult {
  if (!rawType || rawType.trim().length === 0) {
    return { type: "ELECTRICITY", confidence: 0.1, source: "fallback" };
  }

  const normalized = rawType.trim().toLowerCase();

  const exactMatch = EXACT_TYPE_MAP[normalized];
  if (exactMatch) {
    return {
      type: exactMatch,
      confidence: 1.0,
      source: "exact",
      matchedPattern: normalized,
    };
  }

  for (const { pattern, type } of TYPE_PATTERNS) {
    if (pattern.test(rawType)) {
      return {
        type,
        confidence: 0.8,
        source: "pattern",
        matchedPattern: pattern.source,
      };
    }
  }

  return { type: "ELECTRICITY", confidence: 0.1, source: "fallback" };
}

export function detectMeterTypeFromName(
  name: string | null | undefined,
): TypeDetectionResult {
  if (!name || name.trim().length === 0) {
    return { type: "ELECTRICITY", confidence: 0.1, source: "fallback" };
  }

  for (const { pattern, type } of TYPE_PATTERNS) {
    if (pattern.test(name)) {
      return {
        type,
        confidence: 0.6, // Lavere enn fra dedikert type-kolonne
        source: "pattern",
        matchedPattern: pattern.source,
      };
    }
  }

  return { type: "ELECTRICITY", confidence: 0.1, source: "fallback" };
}

export function detectIsSubMeter(context: {
  name?: string | null;
  parentName?: string | null;
  isSubMeterField?: string | null;
  meterLocation?: string | null;
}): { isSubMeter: boolean; confidence: number } {
  if (context.isSubMeterField) {
    const val = context.isSubMeterField.toLowerCase().trim();
    if (["ja", "yes", "true", "1", "x", "undermåler", "under"].includes(val)) {
      return { isSubMeter: true, confidence: 1.0 };
    }
    if (["nei", "no", "false", "0", "hoved", "main"].includes(val)) {
      return { isSubMeter: false, confidence: 1.0 };
    }
  }

  if (context.parentName && context.parentName.trim().length > 0) {
    return { isSubMeter: true, confidence: 0.9 };
  }

  if (context.name) {
    const n = context.name.toLowerCase();
    if (/\bunder/i.test(n) || /\bsub\b/i.test(n) || /\bdel\s*m[åa]l/i.test(n)) {
      return { isSubMeter: true, confidence: 0.7 };
    }
    if (
      /\bhovedfordeling\b/i.test(n) ||
      /\bunderfordeling\b/i.test(n) ||
      /\bfordeling\b/i.test(n)
    ) {
      return { isSubMeter: true, confidence: 0.85 };
    }
    if (
      /\bventilasjon\b/i.test(n) ||
      /\bgulvvarme\b/i.test(n) ||
      /\baerotemper\b/i.test(n) ||
      /\bvvb\b/i.test(n) ||
      /\bvarmtvann/i.test(n) ||
      /\bsn[øo]smelt/i.test(n) ||
      /\bradiator/i.test(n) ||
      /\bvarmebatteri/i.test(n) ||
      /\bkj[øo]lebatteri/i.test(n) ||
      /\bkj[øo]lebafle/i.test(n) ||
      /\bkomfortkj[øo]l/i.test(n) ||
      /\bchiller/i.test(n)
    ) {
      return { isSubMeter: true, confidence: 0.8 };
    }
    if (/\bhoved/i.test(n) || /\bmain\b/i.test(n) || /\btotal\b/i.test(n)) {
      return { isSubMeter: false, confidence: 0.8 };
    }
  }

  return { isSubMeter: false, confidence: 0.3 };
}


export function meterTypeLabel(type: MeteringPointType): string {
  switch (type) {
    case "ELECTRICITY":
      return "Strøm";
    case "HEAT":
      return "Varme";
    case "COOLING":
      return "Kjøling";
    case "PRODUCTION":
      return "Produksjon";
    case "WATER":
      return "Vann";
    default:
      return type;
  }
}

export const ALL_METER_TYPES: MeteringPointType[] = [
  "ELECTRICITY",
  "HEAT",
  "COOLING",
  "PRODUCTION",
  "WATER",
];
