import { Droplets, Flame, Snowflake, Sun, Zap } from "lucide-react";
import type {
  CtPlacement,
  EnergyFlowStage,
  MeterHierarchyRole,
  MeteringPointType,
  SubMeterCategory,
  SubMeterSubCategory,
} from "@/generated/client";

export type MpidPolicy = "ELHUB" | "FREE";

export const ELHUB_MPID_PREFIX = "7070575000";

export const ELHUB_MPID_MAX_LENGTH = 18;

export function isValidElhubMpid(mpid: string): boolean {
  const trimmed = mpid.trim().replace(/\s/g, "");
  return new RegExp(`^${ELHUB_MPID_PREFIX}\\d{8}$`).test(trimmed);
}

export const FREE_MPID_MAX_LENGTH = 128;

export function sanitizeElhubMpidInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, ELHUB_MPID_MAX_LENGTH);
}

export function sanitizeFreeMpidInput(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, FREE_MPID_MAX_LENGTH);
}

export function sanitizeMpidInputForPolicy(
  policy: MpidPolicy,
  raw: string,
): string {
  return policy === "ELHUB"
    ? sanitizeElhubMpidInput(raw)
    : sanitizeFreeMpidInput(raw);
}

export function sanitizeMpidInputForArchetype(
  archetype: { mpidPolicy: MpidPolicy } | null,
  raw: string,
): string {
  if (!archetype) return sanitizeFreeMpidInput(raw);
  return sanitizeMpidInputForPolicy(archetype.mpidPolicy, raw);
}

export type ArchetypeId =
  | "EL_MAIN"
  | "EL_SUB"
  | "EL_MAIN_DISTRIBUTION"
  | "HEAT_MAIN"
  | "HEAT_SUB"
  | "HEAT_PRODUCTION"
  | "COOL_MAIN"
  | "COOL_SUB"
  | "PRODUCTION_PV"
  | "WATER";

export type Archetype = {
  id: ArchetypeId;
  label: string;
  shortLabel: string;
  hint: string;
  type: MeteringPointType;
  isSubMeter: boolean;
  mpidPolicy: MpidPolicy;
  subMeterCategory?: SubMeterCategory | null;
  subMeterSubCategory?: SubMeterSubCategory | null;
  parentRecommended: boolean;
  isMainDistribution?: boolean;
  typicalKsTag: string | null;
  typicalKsTagLabel?: string | null;
  typicalKsSecondary?: { tag: string; label?: string | null } | null;
  allowedFlowStages: EnergyFlowStage[];
  allowedHierarchyRoles: MeterHierarchyRole[];
  allowedCtPlacements: CtPlacement[];
  Icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
};

export const ARCHETYPES: Archetype[] = [
  {
    id: "EL_MAIN",
    label: "Strøm — hovedmåler (AMS)",
    shortLabel: "Hovedmåler (AMS)",
    hint: "Byggets hovedmåler for strøm (AMS). Data synkes automatisk.",
    type: "ELECTRICITY",
    isSubMeter: false,
    mpidPolicy: "ELHUB",
    parentRecommended: false,
    typicalKsTag: null,
    typicalKsTagLabel: "Identifiseres med Elhub-ID",
    allowedFlowStages: ["GRID_DELIVERED", "GRID_EXPORTED"],
    allowedHierarchyRoles: ["TOTAL"],
    allowedCtPlacements: ["FEED_MAIN"],
    Icon: Zap,
    iconClass: "text-blue-500",
  },
  {
    id: "EL_MAIN_DISTRIBUTION",
    label: "Strøm — Hovedfordeling (intern toppmåler)",
    shortLabel: "Hovedfordeling",
    hint: "Når bygget mangler egen AMS: måler i hovedtavle som dekker hele strømforbruket.",
    type: "ELECTRICITY",
    isSubMeter: true,
    mpidPolicy: "FREE",
    parentRecommended: false,
    isMainDistribution: true,
    typicalKsTag: "432",
    typicalKsTagLabel: "Hovedfordeling (lavspent)",
    allowedFlowStages: ["CONSUMPTION", "CONVERSION_INPUT"],
    allowedHierarchyRoles: ["TOTAL", "BRANCH"],
    allowedCtPlacements: ["FEED_MAIN", "LOAD_BRANCH"],
    Icon: Zap,
    iconClass: "text-blue-500",
  },
  {
    id: "EL_SUB",
    label: "Strøm — undermåler",
    shortLabel: "Undermåler",
    hint: "Måler på fordeling, etasje eller sone under hovedmåleren.",
    type: "ELECTRICITY",
    isSubMeter: true,
    mpidPolicy: "FREE",
    parentRecommended: true,
    typicalKsTag: "433",
    typicalKsTagLabel: "Alminnelig forbruk",
    allowedFlowStages: ["CONSUMPTION", "CONVERSION_INPUT"],
    allowedHierarchyRoles: ["BRANCH", "LEAF", "STANDALONE"],
    allowedCtPlacements: ["LOAD_BRANCH", "FEED_MAIN"],
    Icon: Zap,
    iconClass: "text-blue-500",
  },
  {
    id: "HEAT_MAIN",
    label: "Fjernvarme inn til bygget",
    shortLabel: "Fjernvarme inn",
    hint: "Varme levert inn til bygget (f.eks. fjernvarme), målt ved grensen.",
    type: "HEAT",
    isSubMeter: false,
    mpidPolicy: "FREE",
    parentRecommended: false,
    typicalKsTag: "321",
    typicalKsTagLabel: "Varme — bunnledning / fjernvarmerør",
    allowedFlowStages: ["GRID_DELIVERED"],
    allowedHierarchyRoles: ["TOTAL"],
    allowedCtPlacements: ["THERMAL_DELIVERY"],
    Icon: Flame,
    iconClass: "text-red-500",
  },
  {
    id: "HEAT_SUB",
    label: "Varme — undermåler / distribusjon",
    shortLabel: "Distribusjon",
    hint: "Fordeling av innkjøpt varme inne: radiator, gulvvarme, sone osv.",
    type: "HEAT",
    isSubMeter: true,
    mpidPolicy: "FREE",
    parentRecommended: true,
    subMeterCategory: "OPPVARMING",
    typicalKsTag: "322",
    typicalKsTagLabel: "Varme — ledningsnett over grunn",
    allowedFlowStages: ["DISTRIBUTION"],
    allowedHierarchyRoles: ["BRANCH", "LEAF", "STANDALONE"],
    allowedCtPlacements: ["THERMAL_DELIVERY"],
    Icon: Flame,
    iconClass: "text-orange-500",
  },
  {
    id: "HEAT_PRODUCTION",
    label: "Varmepumpe / el-kjel — produksjon",
    shortLabel: "Varmepumpe",
    hint: "Lokal varme (f.eks. varmepumpe eller el-kjel).",
    type: "HEAT",
    isSubMeter: true,
    mpidPolicy: "FREE",
    parentRecommended: false,
    subMeterCategory: "VARMEPUMPE",
    subMeterSubCategory: "VP_PRODUKSJON",
    typicalKsTag: "350",
    typicalKsTagLabel: "Varmepumpe- og kuldeanlegg (§35)",
    typicalKsSecondary: {
      tag: "454",
      label: "Vannvarmere og elektrokjeler (§45)",
    },
    allowedFlowStages: ["PRODUCTION_GROSS", "AMBIENT_SOURCE"],
    allowedHierarchyRoles: ["TOTAL", "STANDALONE"],
    allowedCtPlacements: ["THERMAL_PRODUCTION", "AMBIENT"],
    Icon: Flame,
    iconClass: "text-amber-500",
  },
  {
    id: "COOL_MAIN",
    label: "Fjernkjøling inn til bygget",
    shortLabel: "Fjernkjøling inn",
    hint: "Kjøling levert inn til bygget, målt der anlegget kommer inn.",
    type: "COOLING",
    isSubMeter: false,
    mpidPolicy: "FREE",
    parentRecommended: false,
    typicalKsTag: "370",
    typicalKsTagLabel: "Komfortkjøleanlegg",
    allowedFlowStages: ["GRID_DELIVERED"],
    allowedHierarchyRoles: ["TOTAL"],
    allowedCtPlacements: ["THERMAL_DELIVERY"],
    Icon: Snowflake,
    iconClass: "text-cyan-500",
  },
  {
    id: "COOL_SUB",
    label: "Kjøling — undermåler",
    shortLabel: "Distribusjon",
    hint: "Fordeling av kjøling inne (komfort, batteri, sone).",
    type: "COOLING",
    isSubMeter: true,
    mpidPolicy: "FREE",
    parentRecommended: true,
    subMeterCategory: "KJOLING",
    typicalKsTag: "370",
    typicalKsTagLabel: "Komfortkjøleanlegg",
    allowedFlowStages: ["DISTRIBUTION"],
    allowedHierarchyRoles: ["BRANCH", "LEAF", "STANDALONE"],
    allowedCtPlacements: ["THERMAL_DELIVERY"],
    Icon: Snowflake,
    iconClass: "text-sky-400",
  },
  {
    id: "PRODUCTION_PV",
    label: "Solceller / produksjon",
    shortLabel: "Solceller",
    hint: "Solceller eller annen lokal kraftproduksjon (ofte målt ved inverter).",
    type: "PRODUCTION",
    isSubMeter: false,
    mpidPolicy: "FREE",
    parentRecommended: false,
    subMeterCategory: "SOLCELLE",
    subMeterSubCategory: "INVERTER",
    typicalKsTag: "471",
    typicalKsTagLabel: "Solcellesystem",
    allowedFlowStages: ["PRODUCTION_GROSS", "GRID_EXPORTED"],
    allowedHierarchyRoles: ["STANDALONE", "TOTAL"],
    allowedCtPlacements: ["PV_OUTPUT"],
    Icon: Sun,
    iconClass: "text-amber-500",
  },
  {
    id: "WATER",
    label: "Vannmåler",
    shortLabel: "Vann",
    hint: "Sanitær og annet vannforbruk utenom energiregnskapet.",
    type: "WATER",
    isSubMeter: false,
    mpidPolicy: "FREE",
    parentRecommended: false,
    typicalKsTag: "310",
    typicalKsTagLabel: "Sanitæranlegg",
    allowedFlowStages: ["CONSUMPTION", "GRID_DELIVERED"],
    allowedHierarchyRoles: ["STANDALONE", "TOTAL"],
    allowedCtPlacements: [],
    Icon: Droplets,
    iconClass: "text-blue-400",
  },
];

export const ARCHETYPE_BY_ID = new Map<ArchetypeId, Archetype>(
  ARCHETYPES.map((a) => [a.id, a]),
);

export function getArchetype(
  id: ArchetypeId | null | undefined,
): Archetype | null {
  if (!id) return null;
  return ARCHETYPE_BY_ID.get(id) ?? null;
}

export type ArchetypeDerivationInput = {
  type: MeteringPointType;
  name?: string | null;
  isSubMeter?: boolean | null;
  flowStage?: EnergyFlowStage | null;
  hierarchyRole?: MeterHierarchyRole | null;
  hasParent?: boolean;
  subMeterCategory?: SubMeterCategory | string | null;
};

export function deriveArchetypeId(
  input: ArchetypeDerivationInput,
): ArchetypeId {
  const {
    type,
    name,
    isSubMeter,
    flowStage,
    hierarchyRole,
    hasParent,
    subMeterCategory,
  } = input;
  const n = name ?? "";
  const sub = Boolean(isSubMeter) || Boolean(hasParent);

  if (type === "ELECTRICITY") {
    if (sub && subMeterCategory) {
      const byCategory = ARCHETYPES.find(
        (a) =>
          a.type === "ELECTRICITY" &&
          a.isSubMeter === true &&
          a.subMeterCategory != null &&
          (a.subMeterCategory ?? null) === (subMeterCategory ?? null),
      );
      if (byCategory) return byCategory.id;
    }
    const looksLikeMainDistribution =
      /\bhovedfordeling\b/i.test(n) || /\bhovedtavle\b/i.test(n);
    if (sub && (hierarchyRole === "TOTAL" || looksLikeMainDistribution)) {
      return "EL_MAIN_DISTRIBUTION";
    }
    if (sub) return "EL_SUB";
    if (looksLikeMainDistribution) return "EL_MAIN_DISTRIBUTION";
    return "EL_MAIN";
  }

  if (type === "HEAT") {
    if (
      subMeterCategory === "VARMEPUMPE" ||
      flowStage === "PRODUCTION_GROSS" ||
      flowStage === "AMBIENT_SOURCE"
    ) {
      return "HEAT_PRODUCTION";
    }
    const looksLikeDistribution =
      /\bventilasjon\b/i.test(n) ||
      /\bgulvvarme\b/i.test(n) ||
      /\baerotemper\b/i.test(n) ||
      /\bvvb\b/i.test(n) ||
      /\bvarmtvann/i.test(n) ||
      /\bsn[øo]smelt/i.test(n) ||
      /\bradiator/i.test(n) ||
      /\bvarmebatteri/i.test(n) ||
      /\bfordeling\b/i.test(n);
    if (flowStage === "DISTRIBUTION" || sub || looksLikeDistribution) {
      return "HEAT_SUB";
    }
    return "HEAT_MAIN";
  }

  if (type === "COOLING") {
    const looksLikeDistribution =
      /\bkomfortkj[øo]l/i.test(n) ||
      /\bkj[øo]lebatteri/i.test(n) ||
      /\bkj[øo]lebafle/i.test(n) ||
      /\bchiller/i.test(n) ||
      /\bventilasjon\b/i.test(n) ||
      /\bfordeling\b/i.test(n);
    if (flowStage === "DISTRIBUTION" || sub || looksLikeDistribution) {
      return "COOL_SUB";
    }
    return "COOL_MAIN";
  }

  if (type === "PRODUCTION") {
    return "PRODUCTION_PV";
  }

  if (type === "WATER") {
    return "WATER";
  }

  return "EL_MAIN";
}

export function isMpidValidForArchetype(
  archetype: Archetype,
  mpid: string,
): boolean {
  const trimmed = mpid.trim().replace(/\s/g, "");
  if (archetype.mpidPolicy === "ELHUB") {
    return isValidElhubMpid(trimmed);
  }
  return trimmed.length >= 3 && trimmed.length <= FREE_MPID_MAX_LENGTH;
}

export function canBeParentOf(
  parentType: MeteringPointType,
  childType: MeteringPointType,
): boolean {
  if (parentType === childType) return true;
  return false;
}

function withSuggested<T extends string>(
  allowed: readonly T[],
  ...extras: Array<T | null | undefined>
): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of allowed) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  for (const v of extras) {
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

export function getAllowedFlowStages(
  archetype: Archetype | null,
  suggested?: EnergyFlowStage | null,
): EnergyFlowStage[] {
  if (!archetype) {
    return [
      "GRID_DELIVERED",
      "GRID_EXPORTED",
      "CONSUMPTION",
      "PRODUCTION_GROSS",
      "DISTRIBUTION",
      "CONVERSION_INPUT",
      "AMBIENT_SOURCE",
    ];
  }
  return withSuggested(archetype.allowedFlowStages, suggested);
}

export function getAllowedHierarchyRoles(
  archetype: Archetype | null,
  suggested?: MeterHierarchyRole | null,
): MeterHierarchyRole[] {
  if (!archetype) {
    return ["TOTAL", "BRANCH", "LEAF", "STANDALONE"];
  }
  return withSuggested(archetype.allowedHierarchyRoles, suggested);
}

export function getAllowedCtPlacements(
  archetype: Archetype | null,
  suggested?: CtPlacement | null,
): CtPlacement[] {
  if (!archetype) {
    return [
      "LOAD_BRANCH",
      "FEED_MAIN",
      "PV_OUTPUT",
      "BATTERY",
      "THERMAL_PRODUCTION",
      "THERMAL_DELIVERY",
      "AMBIENT",
      "UNKNOWN",
    ];
  }
  return withSuggested(archetype.allowedCtPlacements, suggested, "UNKNOWN");
}

export function getManualFormDefaultsFromArchetype(
  archetype: Archetype,
  markAsMainDistribution: boolean,
): {
  type: MeteringPointType;
  isSubMeter: boolean;
  subMeterCategory: SubMeterCategory | null;
  subMeterSubCategory: SubMeterSubCategory | null;
  includeInTotal: boolean;
} {
  return {
    type: archetype.type,
    isSubMeter: archetype.isSubMeter,
    subMeterCategory: archetype.subMeterCategory ?? null,
    subMeterSubCategory: archetype.subMeterSubCategory ?? null,
    includeInTotal: !archetype.isSubMeter || markAsMainDistribution,
  };
}
