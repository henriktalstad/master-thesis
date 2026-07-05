import type { InfraspawnPointCategory } from "@/lib/infraspawn/point-classification";
import {
  type InfraspawnPointHaystackInput,
  infraspawnPointHaystack,
} from "@/lib/infraspawn/point-haystack";
import {
  HEATING_EXACT_POINT_LABELS,
  resolveHeatingExactPointLabel,
} from "@/lib/sd-anlegg/heating-signal-vocabulary";
import { HEATING_DASHBOARD_VOCABULARY } from "@/lib/sd-anlegg/heating-dashboard-vocabulary";

export type InfraspawnKeyPointRole =
  | "supply_air_temp"
  | "supply_temp"
  | "return_temp"
  | "outdoor_temp"
  | "power"
  | "energy"
  | "flow"
  | "volume"
  | "valve"
  | "pump"
  | "alarm";

export type PointVocabularyInput = InfraspawnPointHaystackInput;

export const INFRASPAWN_EXACT_POINT_LABELS: Record<string, string> = {
  AI_FilterGuard1: "Filtervakt inntak",
  AI_FilterGuard2: "Filtervakt avtrekk",
  AI_EAFPressure: "Trykk avtrekkskanal",
  AI_SAFPressure: "Trykk tilluftskanal",
  AI_EAFFlow: "Luftmengde avtrekk",
  AI_SAFFlow: "Luftmengde tilluft",
  AI_SupplyAirTemp: "Tillufttemperatur",
  AI_IntakeAirTemp: "Inntakslufttemperatur",
  AI_ExtractAirTemp: "Avtrekkstemperatur",
  AI_EfficiencyTemp: "Temperatur etter varmegjenvinner",
  Efficiency: "Virkningsgrad varmegjenvinner",
  Lowefficiency: "Lav virkningsgrad (varmegjenvinner)",
  Rotationguardexchanger: "Rotasjonsvakt varmegjenvinner",
  AO_EAF: "Viftehastighet avtrekk",
  AO_SAF: "Viftehastighet tilluft",
  AO_3: "Pådrag varmebatteri",
  AO_5: "Pådrag kjølebatteri",
  DO_EAFStart: "Drift avtrekksvifte",
  DO_SAFStart: "Drift tilluftsvifte",
  SAFAutoMode: "Driftsmodus tilluftsvifte",
  EAFAutoMode: "Driftsmodus avtrekksvifte",
  SAFcontError: "Følgefeil tilluftsvifte",
  EAFcontError: "Følgefeil avtrekksvifte",
  AirUnitAutoMode: "Driftsmodus aggregat",
  "360102_Plantmode_KV": "Anleggsmodus",
  Frostrisk: "Frostvakt",
  SupplyPID_SetP: "Kalkulert tilluftssetpunkt",
  ...HEATING_EXACT_POINT_LABELS,
  Firealarm: "Brannalarm",
  Smokedetectoralarm: "Røykvarsler",
  SumAlarm: "Sumalarm",
  SumAlarmA: "Sumalarm A",
  SumAlarmB: "Sumalarm B",
  SumAlarmC: "Sumalarm C",
};

type SemanticCategory = Exclude<
  InfraspawnPointCategory,
  "all" | "alarm_fault" | "no_value"
>;

type VocabularyEntry = {
  pattern: RegExp;
  label?: string;
  category?: SemanticCategory;
  dashboardRole?: InfraspawnKeyPointRole;
  dashboardWeight?: number;
  unitHint?: string;
};

const VOCABULARY: VocabularyEntry[] = [
  {
    pattern: /turtemp|turvann/i,
    label: "Turtemperatur",
    category: "temperature",
    dashboardRole: "supply_temp",
    dashboardWeight: 3,
    unitHint: "degree",
  },
  {
    pattern: /supply air temp|supplyairtemp/i,
    label: "Tillufttemperatur",
    category: "temperature",
    dashboardRole: "supply_air_temp",
    dashboardWeight: 4,
    unitHint: "degree",
  },
  {
    pattern: /returtemp|returvann/i,
    label: "Returtemperatur",
    category: "temperature",
    dashboardRole: "return_temp",
    dashboardWeight: 3,
    unitHint: "degree",
  },
  {
    pattern: /extract air temp|extractairtemp/i,
    label: "Avtrekkstemperatur",
    category: "temperature",
    unitHint: "degree",
  },
  {
    pattern: /utetemp|outdoor|intake.?air|inntaksluft/i,
    label: "Utetemperatur",
    category: "temperature",
    dashboardRole: "outdoor_temp",
    dashboardWeight: 4,
    unitHint: "degree",
  },
  {
    pattern: /romtemp|room.*temp|innertemp|frost(?!prot)/i,
    label: "Romtemperatur",
    category: "temperature",
    unitHint: "degree",
  },
  {
    pattern: /saf.*press|supply.*air.*press/i,
    label: "Trykk tilluftskanal",
    category: "pressure",
  },
  {
    pattern: /eaf.*press|extract.*air.*press/i,
    label: "Trykk avtrekkskanal",
    category: "pressure",
  },
  {
    pattern: /(?:saf|eaf).*press|duct.*press|kanaltrykk|kanal.?trykk/i,
    label: "Kanaltrykk",
    category: "pressure",
  },
  {
    pattern: /differansetrykk|rp\d{3}/i,
    label: "Differansetrykk",
    category: "pressure",
  },
  {
    pattern: /turvann|returvann/i,
    label: "Temperatur turvann",
    category: "temperature",
    unitHint: "degree",
  },
  {
    pattern: /effekt|power(?!.*hour)|kilowatt(?!-hour)/i,
    label: "Effekt",
    category: "energy",
    dashboardRole: "power",
    dashboardWeight: 4,
    unitHint: "kilowatt",
  },
  {
    pattern: /energi|energy|kilowatt-hour|kwh/i,
    label: "Energi akkumulert",
    category: "energy",
    dashboardRole: "energy",
    dashboardWeight: 4,
    unitHint: "kilowatt-hour",
  },
  {
    pattern: /flow|m3\/h|cubic-meters-per-hour|volumstr/i,
    label: "Volumstrøm",
    category: "flow",
    dashboardRole: "flow",
    dashboardWeight: 4,
    unitHint: "cubic-meters-per-hour",
  },
  {
    pattern: /volum|volume/i,
    label: "Volum",
    category: "flow",
    dashboardRole: "volume",
    dashboardWeight: 4,
    unitHint: "cubic-meters",
  },
  {
    pattern: /ventil|valve|reguleringsventil|varmeventil/i,
    label: "Ventilstilling",
    category: "pumps_valves",
    dashboardRole: "valve",
    dashboardWeight: 4,
    unitHint: "percent",
  },
  {
    pattern: /\bJP\d+/i,
    label: "Pumpestatus",
    category: "pumps_valves",
    dashboardRole: "pump",
    dashboardWeight: 4,
  },
  {
    pattern: /\bSB\d+/i,
    label: "Ventilstilling",
    category: "pumps_valves",
    dashboardRole: "valve",
    dashboardWeight: 4,
    unitHint: "percent",
  },
  {
    pattern: /\bRT\d+.*(?:mv|turvann|returvann|turtemp|returtemp)/i,
    label: "Temperatur",
    category: "temperature",
    unitHint: "degree",
  },
  {
    pattern: /\bRP\d+/i,
    label: "Differansetrykk",
    category: "pressure",
    unitHint: "pascal",
  },
  {
    pattern: /\bOE00\d/i,
    label: "Energimåler",
    category: "energy",
    dashboardWeight: 3,
  },
  {
    pattern: /pumpe|pump|jp401|jp402|jp501/i,
    label: "Pumpestatus",
    category: "pumps_valves",
    dashboardRole: "pump",
    dashboardWeight: 3,
  },
  {
    pattern: /kompenseringskurve|compensation curve|komp\.?kurve/i,
    category: "temperature",
    unitHint: "degree",
  },
  {
    pattern: /(?:^|[^a-z])sp(?:$|[^a-z])|setpoint|set.?punkt|_SP$/i,
    category: "temperature",
    unitHint: "degree",
  },
  {
    pattern: /regulert verdi|controlled value|present value output/i,
    category: "other",
  },
  {
    pattern: /alarm|fault|feil|brann|smoke|fire|sumalarm/i,
    category: "other",
  },
];

const ALARM_NAME_PATTERN = /alarm|fault|feil|brann|smoke|fire|sumalarm/i;

const DASHBOARD_ROLE_VOCABULARY = [
  ...HEATING_DASHBOARD_VOCABULARY,
  ...VOCABULARY,
] as const;

function looksTechnical(text: string): boolean {
  if (/^[A-Z]{2,}[-_]?[\dA-Z_.-]+$/i.test(text)) return true;
  if (/^\d{3}[._]\d{3}[A-Z]{2}\d{3}/i.test(text)) return true;
  if (/^(AI|AO|AV|BI|BO|BV|MSV)-\d+$/i.test(text)) return true;
  return /^[A-Za-z]+_[A-Za-z0-9_]+$/.test(text) && text.includes("_");
}

/** Engelsk BACnet-beskrivelse eller objectName — skal ikke vises som brukeretikett. */
function looksEnglishProse(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/[æøåÆØÅ]/.test(trimmed)) return false;
  if (
    /\b(temperatur|trykk|luft|vifte|alarm|drift|avtrekk|tilluft|varme|effekt|normal|setpunkt|virkningsgrad|filter|spjeld|pumpe|ventil)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }
  if (INFRASPAWN_EXACT_POINT_LABELS[trimmed]) return true;
  if (
    /\b(efficiency|rotation|guard|exchanger|supply|extract|air|fan|press|temp|sensor|alarm|low|high|mode|status|flow|running|error|cont\.?)\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }
  if (/^[A-Za-z][A-Za-z0-9\s.,\-_/()]+$/.test(trimmed) && trimmed.includes(" ")) {
    return true;
  }
  return false;
}

function normalizeDescription(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || looksTechnical(trimmed) || looksEnglishProse(trimmed)) return null;
  return trimmed;
}

function matchEntries(haystack: string): VocabularyEntry[] {
  return VOCABULARY.filter((entry) => entry.pattern.test(haystack));
}

function resolveStructuredTechnicalLabel(
  input: PointVocabularyInput,
): string | null {
  const haystack = infraspawnPointHaystack(input);
  const name = input.objectName?.trim() ?? "";

  const kompMatch = haystack.match(
    /kompenseringskurve.*?y\s*(\d+)|y\s*(\d+).*kompenseringskurve/i,
  );
  if (kompMatch) {
    const curve = kompMatch[1] ?? kompMatch[2];
    if (/regulert|setpoint|set.?punkt|_SP/i.test(haystack)) {
      return `Setpunkt kompenseringskurve Y${curve}`;
    }
    return `Kompenseringskurve Y${curve}`;
  }

  if (
    /\d+[._]\d*RT\d+_SP/i.test(name) ||
    /\d+[._]\d*RT\d+_SP/i.test(input.objectId) ||
    /RT\d+_SP/i.test(name)
  ) {
    return "Setpunkt returtemperatur";
  }

  if (/TT\d+_SP|TV\d+_SP/i.test(name) || /TT\d+_SP|TV\d+_SP/i.test(input.objectId)) {
    return "Setpunkt turtemperatur";
  }

  if (/_SP$/i.test(name) || /_SP$/i.test(input.objectId)) {
    if (/retur|RT/i.test(haystack)) return "Setpunkt returtemperatur";
    if (/tur|TT|TV|supply/i.test(haystack)) return "Setpunkt turtemperatur";
    if (/ute|outdoor/i.test(haystack)) return "Setpunkt utetemperatur";
    return "Setpunkt";
  }

  return null;
}

function resolveVocabularyLabel(input: PointVocabularyInput): string | null {
  const name = input.objectName?.trim();
  if (name) {
    const heatingExact = resolveHeatingExactPointLabel(name);
    if (heatingExact) return heatingExact;
    const exact = INFRASPAWN_EXACT_POINT_LABELS[name];
    if (exact) return exact;
    const nameMatch = matchEntries(name).find((entry) => entry.label);
    if (nameMatch?.label) return nameMatch.label;
  }

  const structured = resolveStructuredTechnicalLabel(input);
  if (structured) return structured;

  const haystack = infraspawnPointHaystack(input);
  const labelMatch = matchEntries(haystack).find((entry) => entry.label);
  if (labelMatch?.label) return labelMatch.label;

  return null;
}

export function resolveHumanInfraspawnPointLabel(
  input: PointVocabularyInput,
): string | null {
  const vocabulary = resolveVocabularyLabel(input);
  if (vocabulary) return vocabulary;

  const description = input.description
    ? normalizeDescription(input.description)
    : null;
  if (description) return description;

  const name = input.objectName?.trim();
  if (name && !looksTechnical(name)) return name;
  return null;
}

export function formatInfraspawnPointTechnicalRef(
  input: PointVocabularyInput,
): string | null {
  const label = resolveHumanInfraspawnPointLabel(input);
  const name = input.objectName?.trim();
  const id = input.objectId.trim();

  if (name && /^\d{6}_[A-Z0-9_]+$/i.test(name)) {
    return name !== label ? name : null;
  }

  if (name && label && INFRASPAWN_EXACT_POINT_LABELS[name]) {
    return id && id !== label && id !== name ? id : null;
  }

  const parts: string[] = [];
  if (name && name !== label && !looksEnglishProse(name) && !looksTechnical(name)) {
    parts.push(name);
  }
  if (id && id !== label && id !== name) parts.push(id);

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function classifyInfraspawnHaystack(input: {
  haystack: string;
  unit: string;
  prefix: string;
}): SemanticCategory | null {
  const unit = input.unit.toLowerCase();

  if (unit.includes("degree") || /temp|temperatur/.test(input.haystack)) {
    return "temperature";
  }
  if (
    unit.includes("pascal") ||
    unit === "pa" ||
    /trykk|pressure|(?:saf|eaf).*press|duct.?press|kanaltrykk/.test(input.haystack)
  ) {
    return "pressure";
  }
  if (unit.includes("kilowatt") || /effekt|energi|power|energy/.test(input.haystack)) {
    return "energy";
  }
  if (
    unit.includes("cubic") ||
    (unit.includes("meter") && !unit.includes("pascal")) ||
    /flow|volum|volume/.test(input.haystack)
  ) {
    return "flow";
  }
  if (
    input.prefix === "AO" ||
    input.prefix === "BO" ||
    input.prefix === "BI" ||
    input.prefix === "MSVV" ||
    /pumpe|pump|ventil|valve/.test(input.haystack)
  ) {
    return "pumps_valves";
  }

  const semantic = matchEntries(input.haystack).find((entry) => entry.category);
  return semantic?.category ?? null;
}

export function matchesInfraspawnAlarmName(haystack: string): boolean {
  return ALARM_NAME_PATTERN.test(haystack);
}

export function scoreInfraspawnDashboardRole(
  role: InfraspawnKeyPointRole,
  point: PointVocabularyInput,
): number {
  if (role === "alarm") return 0;

  const haystack = infraspawnPointHaystack(point);
  const unit = point.unit?.toLowerCase() ?? "";

  for (const entry of DASHBOARD_ROLE_VOCABULARY) {
    if (entry.dashboardRole !== role || !entry.pattern.test(haystack)) continue;
    let score = entry.dashboardWeight ?? 0;
    if (entry.unitHint && unit.includes(entry.unitHint)) {
      score += entry.unitHint === "degree" ? 2 : 3;
    }
    return score;
  }

  return 0;
}

export const INFRASPAWN_DASHBOARD_ROLE_LABELS: Record<
  InfraspawnKeyPointRole,
  string
> = {
  supply_air_temp: "Tillufttemperatur",
  supply_temp: "Turtemperatur",
  return_temp: "Returtemperatur",
  outdoor_temp: "Utetemperatur",
  power: "Effekt",
  energy: "Energi akkumulert",
  flow: "Volumstrøm",
  volume: "Volum",
  valve: "Ventilstilling",
  pump: "Pumpestatus",
  alarm: "Aktiv alarm",
};
