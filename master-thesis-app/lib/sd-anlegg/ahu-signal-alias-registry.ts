import { infraspawnPointHaystack } from "@/lib/infraspawn/point-haystack";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { pointMatchesCatalogPattern } from "@/lib/sd-anlegg/control/signal-pattern-match";

export type AhuSignalAliasEntry = {
  patterns: readonly string[];
  slotId: string;
  description: string;
  canonicalIds?: readonly string[];
};

export function compactAliasToken(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeAliasKey(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, "_");
}

export const AHU_SIGNAL_ALIAS_REGISTRY: readonly AhuSignalAliasEntry[] = [
  // —— Tilluftsvifte JV401 ——
  {
    patterns: ["AI_SAFFlow", "360102_JV401_KV"],
    slotId: "supply.fan",
    description: "Luftmengde tilluft",
  },
  {
    patterns: ["AI_SAFPressure", "360102_JV401_PV"],
    slotId: "supply.fan",
    description: "Trykk tilluftskanal",
  },
  {
    patterns: ["AO_SAF", "360102_JV401_C"],
    slotId: "supply.fan",
    description: "Pådrag tilluftsvifte",
  },
  {
    patterns: ["DO_SAFStart", "360102_JV401_S"],
    slotId: "supply.fan",
    description: "Startsignal tilluftsvifte",
  },
  {
    patterns: ["SAFAutoMode", "360102_JV401_KMD"],
    slotId: "supply.fan",
    description: "Kommando tilluft",
  },
  {
    patterns: ["SAFcontError", "360102_JV401_A"],
    slotId: "supply.fan",
    description: "Alarm tilluftsvifte",
  },
  // —— Avtrekksvifte JV501 ——
  {
    patterns: ["AI_EAFFlow", "360102_JV501_KV"],
    slotId: "exhaust.fan",
    description: "Luftmengde avtrekk",
  },
  {
    patterns: ["AO_EAF", "360102_JV501_C"],
    slotId: "exhaust.fan",
    description: "Pådrag avtrekksvifte",
  },
  {
    patterns: ["DO_EAFStart", "360102_JV501_S"],
    slotId: "exhaust.fan",
    description: "Startsignal avtrekksvifte",
  },
  {
    patterns: ["EAFAutoMode", "360102_JV501_KMD"],
    slotId: "exhaust.fan",
    description: "Kommando avtrekk",
  },
  {
    patterns: ["EAFcontError", "360102_JV501_A"],
    slotId: "exhaust.fan",
    description: "Alarm avtrekksvifte",
  },
  {
    patterns: ["AI_EAFPressure", "360102_JV501_PV"],
    slotId: "exhaust.fan",
    description: "Trykk avtrekkskanal",
  },
  // —— Spjeld ——
  {
    patterns: [
      "DO_SADamper",
      "BO_SADamper",
      "SA_Damper",
      "KA401",
      "360102_KA401_S",
      "360102_KA401",
    ],
    slotId: "supply.damper",
    description: "Spjeld inntak",
  },
  {
    patterns: [
      "DO_EADamper",
      "BO_EADamper",
      "EA_Damper",
      "KA501",
      "KA502",
      "360102_KA501_S",
      "360102_KA501",
    ],
    slotId: "exhaust.damper",
    description: "Spjeld avkast",
  },
  // —— Filter ——
  {
    patterns: ["AI_FilterGuard1", "360102_QD401_PV", "QD401"],
    slotId: "supply.filter",
    description: "Filtervakt inntak",
  },
  {
    patterns: ["AI_FilterGuard2", "360102_QD501_PV", "QD501"],
    slotId: "exhaust.filter",
    description: "Filtervakt avtrekk",
  },
  // —— Temperatur ——
  {
    patterns: ["AI_SupplyAirTemp", "360102_RT401_PV", "RT401"],
    slotId: "supply.temp_out",
    description: "Temp. tilluft",
  },
  {
    patterns: ["AI_ExtractAirTemp", "360102_RT501_PV", "RT501"],
    slotId: "exhaust.temp",
    description: "Temp. avtrekk",
  },
  {
    patterns: ["AI_IntakeAirTemp", "360102_RT901_MV", "RT901"],
    slotId: "supply.temp_in",
    description: "Temp. inntak",
  },
  {
    patterns: [
      "AI_EfficiencyTemp",
      "AI_AfterHXTemp",
      "AI_SupplyAirTemp_After",
      "360102_RT402_MV",
      "RT402",
    ],
    slotId: "supply.temp_mid",
    description: "Temp. etter varmegjenvinner",
  },
  {
    patterns: ["AI_FrostprotTemp1", "AI_SupplyCoilTemp", "360102_RT550_MV", "RT550"],
    slotId: "heating.temp",
    description: "Temp. frost varmebatteri",
  },
  // —— Varmegjenvinner LX471 ——
  {
    patterns: ["Efficiency", "360102_LX471_KV", "AI_Efficiency"],
    slotId: "heat_recovery.unit",
    description: "Virkningsgrad varmegjenvinner",
    canonicalIds: ["heat_recovery.efficiency"],
  },
  {
    patterns: ["360102_LX471_C", "LX471_C"],
    slotId: "heat_recovery.unit",
    description: "Pådrag gjenvinner",
    canonicalIds: ["heat_recovery.command"],
  },
  {
    patterns: ["Lowefficiency", "360102_LX471_KV_LOW"],
    slotId: "heat_recovery.unit",
    description: "Lav virkningsgrad",
    canonicalIds: ["constraint.low_efficiency"],
  },
  {
    patterns: ["Rotationguardexchanger"],
    slotId: "heat_recovery.unit",
    description: "Rotasjonsvakt varmegjenvinner",
    canonicalIds: ["heat_recovery.rotation_guard"],
  },
  // —— Varme/kjølebatteri ——
  {
    patterns: ["AO_3", "SB401", "360102_SB401_C"],
    slotId: "heating.valve",
    description: "Pådrag varmebatteri",
  },
  {
    patterns: ["AO_5", "SB501", "360102_SB501_C"],
    slotId: "heating.cool_valve",
    description: "Pådrag kjølebatteri",
  },
  {
    patterns: [
      "DO_SeqPumpY1",
      "DOSelect_SeqPumpY1",
      "360102_JP401_S",
      "360102_JP401_KMD",
    ],
    slotId: "heating.pump",
    description: "Pumpe varmebatteri",
  },
  {
    patterns: [
      "DO_SeqPumpY2",
      "DOSelect_SeqPumpY2",
      "360102_JP501_S",
      "360102_JP501_KMD",
      "JP501",
    ],
    slotId: "heating.pump",
    description: "Pumpe kjølebatteri",
  },
  {
    patterns: ["Malf_pumpheater", "360102_JP401_A"],
    slotId: "heating.pump",
    description: "Alarm pumpe varmebatteri",
  },
  {
    patterns: ["Malf_pumpcooler", "360102_JP501_A"],
    slotId: "heating.pump",
    description: "Alarm pumpe kjølebatteri",
  },
  // —— Drift-stripe ——
  {
    patterns: ["UnitMode", "Systemstatus", "360102_Plantmode_KV"],
    slotId: "status.system",
    description: "Systemstatus / anleggsmodus",
  },
  {
    patterns: [
      "AirUnitAutoMode",
      "360102_KMD_MSV",
      "360102_FORLENGET DRIFT",
      "360102_UR",
    ],
    slotId: "status.schedule",
    description: "Tidsprogram / driftsmodus",
  },
  {
    patterns: [
      "360102_RT401_SPK",
      "SupplyPID_SetP",
      "360102_RT401_SP",
      "SupplySetpoint",
    ],
    slotId: "status.setpoint",
    description: "Kalkulert settpunkt tilluft",
  },
  {
    patterns: ["Frostrisk", "360102_FROST"],
    slotId: "status.frost",
    description: "Frostvakt",
  },
  {
    patterns: ["SFP", "360102_SFP"],
    slotId: "status.sfp",
    description: "Specific Fan Power",
  },
] as const;

function buildAliasToSlotMap(): Readonly<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const entry of AHU_SIGNAL_ALIAS_REGISTRY) {
    for (const pattern of entry.patterns) {
      map[normalizeAliasKey(pattern)] = entry.slotId;
      map[compactAliasToken(pattern)] = entry.slotId;
    }
  }
  return map;
}

const ALIAS_DESCRIPTION_BY_PATTERN = (() => {
  const map = new Map<string, string>();
  for (const entry of AHU_SIGNAL_ALIAS_REGISTRY) {
    for (const pattern of entry.patterns) {
      map.set(normalizeAliasKey(pattern), entry.description);
      map.set(compactAliasToken(pattern), entry.description);
    }
  }
  return map;
})();

export const AHU_SIGNAL_ALIAS_TO_SLOT: Readonly<Record<string, string>> =
  buildAliasToSlotMap();

export function resolveAhuSignalAliasSlotId(
  objectName: string | null | undefined,
): string | null {
  if (!objectName?.trim()) return null;
  const normalized = normalizeAliasKey(objectName);
  return (
    AHU_SIGNAL_ALIAS_TO_SLOT[normalized] ??
    AHU_SIGNAL_ALIAS_TO_SLOT[compactAliasToken(objectName)] ??
    null
  );
}

function isLx471ControlSignalName(name: string): boolean {
  const compact = compactAliasToken(name);
  if (compact === "360102LX471C" || compact === "LX471C") return true;
  return name.includes("LX471") && /_C$/.test(name);
}

function isLx471EfficiencySignalName(name: string): boolean {
  const compact = compactAliasToken(name);
  if (compact === "360102LX471KV" || compact === "LX471KV") return true;
  return (
    name.includes("EFFICIENCY") && !name.includes("LOW") && !name.includes("TEMP")
  );
}

export function isHxControlPercentSignal(
  point: Pick<InfraspawnPointListItem, "objectName" | "objectId" | "description">,
): boolean {
  const nameCandidates = [point.objectName, point.objectId].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  for (const candidate of nameCandidates) {
    if (isLx471ControlSignalName(normalizeAliasKey(candidate))) return true;
  }
  const desc = (point.description ?? "").toLowerCase();
  return desc.includes("pådrag") && desc.includes("gjenvinner");
}

export function isHxEfficiencyPercentSignal(
  point: Pick<InfraspawnPointListItem, "objectName" | "objectId" | "description">,
): boolean {
  const nameCandidates = [point.objectName, point.objectId].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  for (const candidate of nameCandidates) {
    if (isLx471EfficiencySignalName(normalizeAliasKey(candidate))) return true;
  }
  const desc = (point.description ?? "").toLowerCase();
  return desc.includes("virkningsgrad");
}

function isLx471ControlSignal(name: string): boolean {
  return isLx471ControlSignalName(normalizeAliasKey(name));
}

function isLx471EfficiencySignal(name: string): boolean {
  return isLx471EfficiencySignalName(normalizeAliasKey(name));
}

function pointMatchesAliasPattern(
  point: Pick<InfraspawnPointListItem, "objectName" | "objectId">,
  pattern: string,
): boolean {
  return pointMatchesCatalogPattern(point, pattern);
}

function descriptionsMatch(
  left: string | null | undefined,
  right: string,
): boolean {
  if (!left?.trim()) return false;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function resolveAhuSignalAliasEntryForPoint(
  point: Pick<InfraspawnPointListItem, "objectName" | "objectId" | "description">,
): AhuSignalAliasEntry | null {
  for (const entry of AHU_SIGNAL_ALIAS_REGISTRY) {
    for (const pattern of entry.patterns) {
      if (pointMatchesAliasPattern(point, pattern)) return entry;
    }
  }

  const nameCandidates = [point.objectName, point.objectId].filter(
    (value): value is string => Boolean(value?.trim()),
  );

  for (const candidate of nameCandidates) {
    const upper = candidate.trim().toUpperCase();
    if (isLx471ControlSignal(upper)) {
      return (
        AHU_SIGNAL_ALIAS_REGISTRY.find((entry) =>
          entry.patterns.some((pattern) => pattern.includes("LX471_C")),
        ) ?? null
      );
    }
    if (isLx471EfficiencySignal(upper)) {
      return (
        AHU_SIGNAL_ALIAS_REGISTRY.find((entry) =>
          entry.canonicalIds?.includes("heat_recovery.efficiency"),
        ) ?? null
      );
    }
  }

  const hay = infraspawnPointHaystack(point);
  if (/pådrag\s*gjenvinner/.test(hay)) {
    return (
      AHU_SIGNAL_ALIAS_REGISTRY.find((entry) =>
        entry.patterns.some((pattern) => pattern.includes("LX471_C")),
      ) ?? null
    );
  }

  if (point.description?.trim()) {
    for (const entry of AHU_SIGNAL_ALIAS_REGISTRY) {
      if (descriptionsMatch(point.description, entry.description)) return entry;
    }
  }

  return null;
}

export function resolveCanonicalIdsForAliasPoint(
  point: Pick<InfraspawnPointListItem, "objectName" | "objectId" | "description">,
): readonly string[] {
  const entry = resolveAhuSignalAliasEntryForPoint(point);
  if (entry?.canonicalIds?.length) return entry.canonicalIds;
  if (entry) return [];
  return [];
}

export function resolveAhuSignalAliasSlotIdForPoint(
  point: Pick<InfraspawnPointListItem, "objectName" | "objectId" | "description">,
): string | null {
  return resolveAhuSignalAliasEntryForPoint(point)?.slotId ?? null;
}

export function resolveAhuSignalFdvDescription(
  objectName: string | null | undefined,
): string | null {
  if (!objectName?.trim()) return null;
  const normalized = normalizeAliasKey(objectName);
  return (
    ALIAS_DESCRIPTION_BY_PATTERN.get(normalized) ??
    ALIAS_DESCRIPTION_BY_PATTERN.get(compactAliasToken(objectName)) ??
    null
  );
}

export function isEquipmentBandPrefixedObjectName(objectName: string | null | undefined): boolean {
  if (!objectName?.trim()) return false;
  return /^360102_/i.test(objectName.trim());
}

export const AHU_PUMP_PROCESS_SETTINGS_IDS = {
  JP401: "pump.heater.command",
  JP501: "pump.cooler.command",
} as const satisfies Record<string, string>;

export type AhuPumpProcessSettingsId =
  (typeof AHU_PUMP_PROCESS_SETTINGS_IDS)[keyof typeof AHU_PUMP_PROCESS_SETTINGS_IDS];

export const AHU_PUMP_PROCESS_SETTINGS_LABELS = {
  "pump.heater.command": "Kommando pumpe varmebatteri",
  "pump.cooler.command": "Kommando pumpe kjølebatteri",
} as const satisfies Record<AhuPumpProcessSettingsId, string>;

export const AHU_PUMP_SETTINGS_SCOPE_PATTERNS = [
  "DOSelect_SeqPumpY1",
  "DOSelect_SeqPumpY2",
  "360102_JP401_KMD",
  "360102_JP501_KMD",
] as const;

export function resolveAhuPumpProcessSettingsId(
  equipmentCode: string,
): AhuPumpProcessSettingsId | undefined {
  const key = equipmentCode.trim().toUpperCase();
  switch (key) {
    case "JP401":
      return "pump.heater.command";
    case "JP501":
      return "pump.cooler.command";
    default:
      return undefined;
  }
}

function normalizePumpCommandToken(
  point: Pick<InfraspawnPointListItem, "objectName" | "objectId">,
): string {
  return (point.objectName ?? point.objectId).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function resolvePumpSettingsIdFromCommandPoint(
  point: Pick<InfraspawnPointListItem, "objectName" | "objectId">,
): AhuPumpProcessSettingsId | undefined {
  const name = normalizePumpCommandToken(point);
  if (/SEQPUMPY2|JP501/.test(name)) return "pump.cooler.command";
  if (/SEQPUMPY1|JP401/.test(name)) return "pump.heater.command";
  return undefined;
}
