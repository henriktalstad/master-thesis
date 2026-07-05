import { resolveHumanInfraspawnPointLabel } from "@/lib/infraspawn/point-vocabulary";
import { parseInfraspawnPointIdentity } from "@/lib/infraspawn/parse-infraspawn-point-identity";
import { isSdAnleggsenhetElementKey } from "@/lib/infraspawn/parse-infraspawn-tfm-identity";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  AHU_BLUEPRINT_PROCESS_SLOTS,
  AHU_BLUEPRINT_STATUS_SLOTS,
  resolveAhuBlueprintEquipmentCodes,
} from "./ahu-blueprint";
import {
  resolveAhuSignalAliasSlotId,
  resolveAhuSignalFdvDescription,
  isEquipmentBandPrefixedObjectName,
} from "./ahu-signal-alias-registry";
import {
  buildAhuPresentationModel,
  type AhuPresentationModel,
} from "./ahu-equipment-identification";
import {
  pointMetadataOverrideKey,
  type SdAnleggPointMetadataOverride,
} from "./point-metadata-overrides";

export type SignalMetadataSuggestionField = {
  value: string;
  confidence: "high" | "medium" | "low";
  source: string;
};

export type SignalMetadataSuggestions = {
  objectName?: SignalMetadataSuggestionField;
  description?: SignalMetadataSuggestionField;
  scopeId?: SignalMetadataSuggestionField;
  schemaSlotId?: SignalMetadataSuggestionField;
};

export type SignalOnboardingReviewItem = {
  point: InfraspawnPointListItem;
  priority: number;
  reason: string;
  suggestedSlotId?: string;
};

const SLOT_FDV_DESCRIPTIONS: Readonly<Record<string, string>> = {
  "supply.temp_out": "Temp. tilluft",
  "supply.temp_in": "Temp. tilluft inn",
  "supply.temp_mid": "Temp. etter varmegenvinner",
  "exhaust.temp": "Temp. avtrekk",
  "supply.fan": "Tilluftsvifte",
  "exhaust.fan": "Avtrekksvifte",
  "supply.damper": "Tilluftspjeld",
  "exhaust.damper": "Avtrekkspjeld",
  "supply.filter": "Filtervakt inntak",
  "exhaust.filter": "Filtervakt avtrekk",
  "supply.pressure": "Trykk tilluft",
  "heat_recovery.unit": "Varmegjenvinner",
  "heating.temp": "Temperatur varmebatteri",
  "heating.valve": "Pådrag varmebatteri",
  "heating.cool_valve": "Pådrag kjølebatteri",
  "heating.coil": "Varmebatteri",
  "heating.pump": "Sirkulasjonspumpe",
  "status.system": "Systemstatus",
  "status.schedule": "Tidsprogram",
  "status.setpoint": "Kalkulert verdi",
  "status.frost": "Frostvakt",
  "status.sfp": "SFP",
};

const SLOT_BY_ID = new Map(
  [...AHU_BLUEPRINT_PROCESS_SLOTS, ...AHU_BLUEPRINT_STATUS_SLOTS].map(
    (slot) => [slot.slotId, slot] as const,
  ),
);

function resolveSlotFromAlias(objectName: string | null | undefined): string | null {
  return resolveAhuSignalAliasSlotId(objectName);
}

function compactElementKey(elementKey: string): string {
  return elementKey.replace(/[.\s]/g, "");
}

function inferEquipmentTagSuffix(
  point: Pick<InfraspawnPointListItem, "objectId" | "objectName" | "description">,
): string {
  const identity = parseInfraspawnPointIdentity(point);
  if (identity?.signalSuffix) {
    return identity.signalSuffix.toUpperCase();
  }

  const name = point.objectName?.trim() ?? "";
  const suffixMatch = /_([A-Z]{2,4})$/i.exec(name);
  if (suffixMatch?.[1]) {
    return suffixMatch[1].toUpperCase();
  }

  const objectId = point.objectId.toLowerCase();
  if (/^ao[-_:]|analogoutput|multi-state/i.test(objectId)) return "MV";
  if (/^do[-_:]|binaryoutput|bo[-_:]/i.test(objectId)) return "MV";
  if (/sp|setpoint|setpunkt/i.test(name) || /sp|setpoint/i.test(point.description ?? "")) {
    return "SP";
  }

  return "PV";
}

function resolveEquipmentCodeForSlot(slotId: string): string | null {
  const slot = SLOT_BY_ID.get(slotId);
  if (!slot) return null;
  if ("equipmentCode" in slot && slot.equipmentCode) {
    return slot.equipmentCode;
  }
  return null;
}

function buildEquipmentTagObjectNameSuggestion(
  point: InfraspawnPointListItem,
  elementKey: string | null | undefined,
  slotId: string | null,
): SignalMetadataSuggestionField | undefined {
  const identity = parseInfraspawnPointIdentity(point);
  if (
    identity?.matchKind === "equipment-compact" ||
    identity?.matchKind === "equipment-underscore" ||
    isEquipmentBandPrefixedObjectName(point.objectName)
  ) {
    return undefined;
  }

  const resolvedElementKey =
    elementKey ??
    (identity?.elementKey && isSdAnleggsenhetElementKey(identity.elementKey)
      ? identity.elementKey
      : null);
  const resolvedSlotId =
    slotId ??
    resolveSlotFromAlias(point.objectName) ??
    (identity?.equipmentCode
      ? AHU_BLUEPRINT_PROCESS_SLOTS.find((slot) =>
          resolveAhuBlueprintEquipmentCodes(slot).some(
            (code) => code.toUpperCase() === identity.equipmentCode?.toUpperCase(),
          ),
        )?.slotId ?? null
      : null);

  const equipmentCode =
    identity?.equipmentCode ??
    (resolvedSlotId ? resolveEquipmentCodeForSlot(resolvedSlotId) : null);

  if (!resolvedElementKey || !equipmentCode) return undefined;

  const suffix = inferEquipmentTagSuffix(point);
  const value = `${compactElementKey(resolvedElementKey)}_${equipmentCode}_${suffix}`;

  return {
    value,
    confidence: resolvedSlotId ? "high" : "medium",
    source: resolvedSlotId ? `equipment-tag:${resolvedSlotId}` : "equipment-tag:equipment",
  };
}

function buildDescriptionSuggestion(
  point: InfraspawnPointListItem,
  slotId: string | null,
): SignalMetadataSuggestionField | undefined {
  if (point.description?.trim()) return undefined;

  const aliasDescription = resolveAhuSignalFdvDescription(point.objectName);
  if (aliasDescription) {
    return {
      value: aliasDescription,
      confidence: "high",
      source: "ahu-signal-alias-registry",
    };
  }

  if (slotId && SLOT_FDV_DESCRIPTIONS[slotId]) {
    return {
      value: SLOT_FDV_DESCRIPTIONS[slotId]!,
      confidence: "high",
      source: `fdv:${slotId}`,
    };
  }

  const label = resolveHumanInfraspawnPointLabel(point);
  if (label && label !== point.objectName?.trim()) {
    return {
      value: label,
      confidence: "medium",
      source: "vocabulary",
    };
  }

  return undefined;
}

function buildScopeSuggestion(
  point: InfraspawnPointListItem,
  elementKey: string | null | undefined,
): SignalMetadataSuggestionField | undefined {
  const identity = parseInfraspawnPointIdentity(point);
  const unitKey =
    elementKey ??
    (identity?.elementKey && isSdAnleggsenhetElementKey(identity.elementKey)
      ? identity.elementKey
      : null);

  if (!unitKey) return undefined;

  return {
    value: `${point.sourceId}:${unitKey}`,
    confidence: elementKey ? "high" : "medium",
    source: elementKey ? "workspace-scope" : "tfm-scope",
  };
}

function resolveSlotFromModel(
  point: InfraspawnPointListItem,
  model: AhuPresentationModel | null | undefined,
): { slotId: string; confidence: "high" | "medium" | "low" } | null {
  if (!model) return null;

  for (const slot of [...model.processSlots, ...model.statusSlots]) {
    const matches = slot.relatedPoints.some(
      (entry) =>
        entry.sourceId === point.sourceId && entry.objectId === point.objectId,
    );
    if (!matches) continue;
    if (slot.confidence === "missing") continue;
    return {
      slotId: slot.slotId,
      confidence:
        slot.confidence === "exact"
          ? "high"
          : slot.confidence === "alias"
            ? "medium"
            : "low",
    };
  }

  return null;
}

export function suggestPointMetadataOverride(input: {
  point: InfraspawnPointListItem;
  elementKey?: string | null;
  model?: AhuPresentationModel | null;
}): SignalMetadataSuggestions {
  const aliasSlotId = resolveSlotFromAlias(input.point.objectName);
  const modelSlot = resolveSlotFromModel(input.point, input.model);
  const schemaSlotId = modelSlot?.slotId ?? aliasSlotId;

  const suggestions: SignalMetadataSuggestions = {};

  if (schemaSlotId) {
    suggestions.schemaSlotId = {
      value: schemaSlotId,
      confidence: modelSlot?.confidence ?? (aliasSlotId ? "medium" : "low"),
      source: modelSlot ? "bound-slot" : "alias-map",
    };
  }

  const objectName = buildEquipmentTagObjectNameSuggestion(
    input.point,
    input.elementKey,
    schemaSlotId,
  );
  if (objectName) {
    suggestions.objectName = objectName;
  }

  const description = buildDescriptionSuggestion(input.point, schemaSlotId);
  if (description) {
    suggestions.description = description;
  }

  const scopeId = buildScopeSuggestion(input.point, input.elementKey);
  if (scopeId) {
    suggestions.scopeId = scopeId;
  }

  return suggestions;
}

export function mergePointMetadataWithSuggestions(input: {
  point: InfraspawnPointListItem;
  override?: SdAnleggPointMetadataOverride | null;
  suggestions: SignalMetadataSuggestions;
  autoFill?: boolean;
  preferSuggestions?: boolean;
}): {
  objectName: string;
  description: string;
  subCentral: string;
  scopeId: string;
  schemaSlotId: string;
} {
  const mirror = {
    objectName: input.point.objectName?.trim() ?? "",
    description: input.point.description?.trim() ?? "",
  };
  const override = input.override;
  const autoFill = input.autoFill ?? true;

  const pick = (
    field: keyof SignalMetadataSuggestions,
    mirrorValue: string,
    overrideValue?: string,
  ) => {
    if (overrideValue) return overrideValue;
    if (mirrorValue) return mirrorValue;
    const suggestion = input.suggestions[field];
    if (autoFill && suggestion?.value) return suggestion.value;
    return "";
  };

  let objectName = pick("objectName", mirror.objectName, override?.objectName);
  let description = pick("description", mirror.description, override?.description);
  let scopeId = pick("scopeId", "", override?.scopeId);
  let schemaSlotId = pick("schemaSlotId", "", override?.schemaSlotId);

  if (input.preferSuggestions) {
    const identity = parseInfraspawnPointIdentity(input.point);
    const isFlatBacnet =
      !identity ||
      (identity.matchKind !== "equipment-compact" &&
        identity.matchKind !== "equipment-underscore");

    if (isFlatBacnet && input.suggestions.objectName?.value) {
      objectName = input.suggestions.objectName.value;
    }
    if (!input.point.description?.trim() && input.suggestions.description?.value) {
      description = input.suggestions.description.value;
    }
    if (input.suggestions.schemaSlotId?.value) {
      schemaSlotId = input.suggestions.schemaSlotId.value;
    }
    if (!override?.scopeId && input.suggestions.scopeId?.value) {
      scopeId = input.suggestions.scopeId.value;
    }
  }

  return {
    objectName,
    description,
    subCentral: override?.subCentral ?? "",
    scopeId,
    schemaSlotId,
  };
}

export function buildSignalOnboardingReviewQueue(input: {
  points: readonly InfraspawnPointListItem[];
  elementKey?: string | null;
  schemaSlotOverrides?: ReadonlyMap<string, string>;
  overriddenKeys?: ReadonlySet<string>;
}): SignalOnboardingReviewItem[] {
  const model = buildAhuPresentationModel(input.points, {
    elementKey: input.elementKey ?? null,
    schemaSlotOverrides: input.schemaSlotOverrides,
  });

  const missingSlotIds = new Set(
    [...model.processSlots, ...model.statusSlots]
      .filter((slot) => slot.confidence === "missing")
      .map((slot) => slot.slotId),
  );

  const boundPointKeys = new Set<string>();
  for (const slot of [...model.processSlots, ...model.statusSlots]) {
    for (const point of slot.relatedPoints) {
      if (slot.confidence !== "missing") {
        boundPointKeys.add(
          pointMetadataOverrideKey(point.sourceId, point.objectId),
        );
      }
    }
  }

  const items: SignalOnboardingReviewItem[] = [];

  for (const point of input.points) {
    const key = pointMetadataOverrideKey(point.sourceId, point.objectId);
    if (input.overriddenKeys?.has(key)) continue;

    const suggestions = suggestPointMetadataOverride({
      point,
      elementKey: input.elementKey,
      model,
    });
    const aliasSlot = suggestions.schemaSlotId?.value ?? null;
    const identity = parseInfraspawnPointIdentity(point);

    let priority = 0;
    let reason = "Kan forbedres med metadata";

    if (aliasSlot && missingSlotIds.has(aliasSlot)) {
      priority = 100;
      reason = `Mangler slot ${aliasSlot}`;
    } else if (
      aliasSlot &&
      !boundPointKeys.has(key) &&
      suggestions.schemaSlotId?.confidence !== "high"
    ) {
      priority = 80;
      reason = `Tvetydig binding mot ${aliasSlot}`;
    } else if (!identity || identity.confidence === "low") {
      priority = 60;
      reason = "Svak TFM-identitet";
    } else if (suggestions.objectName) {
      priority = 50;
      reason = "Flatt BACnet-navn — utstyrstag-forslag tilgjengelig";
    }

    if (priority >= 50) {
      items.push({
        point,
        priority,
        reason,
        suggestedSlotId: aliasSlot ?? undefined,
      });
    }
  }

  return items.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return (a.point.objectName ?? a.point.objectId).localeCompare(
      b.point.objectName ?? b.point.objectId,
      "nb",
    );
  });
}
