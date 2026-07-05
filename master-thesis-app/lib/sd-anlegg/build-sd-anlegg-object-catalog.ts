import {
  inferInfraspawnSystemDomain,
  InfraspawnSystemDomain,
} from "@/lib/infraspawn/system-domain";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { buildAhuPresentationModel } from "./ahu-equipment-identification";
import {
  filterPointsForAnleggsenhet,
  inferAnleggsenheterFromPoints,
} from "./infer-anleggsenheter";
import {
  inferSdComponentTypeForPoint,
  summarizeSdComponentInference,
} from "./infer-components";
import { buildHeatingDistrictPresentationModel } from "./heating-district-presentation";
import { resolveFdvSignalRole } from "./fdv-signal-registry";
import { findBestBindingRuleMatch } from "./schema-templates/match-binding-rule";
import { HEATING_DISTRICT_SECONDARY_CIRCUIT } from "./schema-templates/templates/heating.district.secondary_circuit";

export type SdAnleggObjectCategory =
  | "critical"
  | "diagnostic"
  | "secondary"
  | "unclassified";

export type SdAnleggMappingConfidence = "high" | "medium" | "low";

export type SdAnleggObjectCatalogEntry = {
  sourceId: string;
  sourceLabel: string;
  objectId: string;
  objectName: string | null;
  description: string | null;
  unit: string | null;
  domain: InfraspawnSystemDomain;
  ownerUnitKey: string;
  ownerDisplayName: string;
  componentType: string | null;
  fdvRole: string | null;
  category: SdAnleggObjectCategory;
  alarmRelevant: boolean;
  uiSlot: string | null;
  deepLinkReady: boolean;
  confidence: SdAnleggMappingConfidence;
  fdvDeviation: string | null;
};

export type SdAnleggObjectCatalog = {
  entries: SdAnleggObjectCatalogEntry[];
  summary: ReturnType<typeof summarizeSdComponentInference>;
  buildingName: string;
  buildingSlug: string;
};

function catalogPointKey(
  point: Pick<InfraspawnPointListItem, "sourceId" | "objectId">,
): string {
  return `${point.sourceId}:${point.objectId}`;
}

function buildVentilationUiSlotIndex(
  points: readonly InfraspawnPointListItem[],
  elementKey: string | null,
): Map<string, string> {
  const index = new Map<string, string>();
  const hasVentilation = points.some(
    (point) => inferInfraspawnSystemDomain(point) === InfraspawnSystemDomain.VENTILATION,
  );
  if (!hasVentilation) return index;

  const model = buildAhuPresentationModel(points, { elementKey });
  for (const slot of model.processSlots) {
    for (const related of slot.relatedPoints) {
      index.set(catalogPointKey(related), slot.equipmentCode);
    }
  }
  for (const slot of model.statusSlots) {
    for (const related of slot.relatedPoints) {
      index.set(catalogPointKey(related), slot.label);
    }
  }
  return index;
}

function buildHeatingUiSlotIndex(
  points: readonly InfraspawnPointListItem[],
  elementKey: string | null,
): Map<string, string> {
  const index = new Map<string, string>();
  const hasHeating = points.some(
    (point) => inferInfraspawnSystemDomain(point) === InfraspawnSystemDomain.HEATING,
  );
  if (!hasHeating) return index;

  const heating = buildHeatingDistrictPresentationModel(points, { elementKey });
  for (const slot of [
    ...heating.lanes.flatMap((lane) => lane.slots),
    ...heating.statusSlots,
    ...(heating.outdoorTemp ? [heating.outdoorTemp] : []),
  ]) {
    const label = `${slot.equipmentCode} (${slot.label})`;
    for (const related of slot.relatedPoints) {
      index.set(catalogPointKey(related), label);
    }
  }

  for (const node of HEATING_DISTRICT_SECONDARY_CIRCUIT.nodes) {
    const match = findBestBindingRuleMatch(points, node.bind, elementKey);
    if (match) {
      index.set(catalogPointKey(match), node.role);
    }
  }
  return index;
}

function resolveUiSlotFromIndexes(
  point: InfraspawnPointListItem,
  ventilationIndex: ReadonlyMap<string, string>,
  heatingIndex: ReadonlyMap<string, string>,
): string | null {
  const key = catalogPointKey(point);
  const domain = inferInfraspawnSystemDomain(point);
  if (domain === InfraspawnSystemDomain.VENTILATION) {
    return ventilationIndex.get(key) ?? null;
  }
  if (domain === InfraspawnSystemDomain.HEATING) {
    return heatingIndex.get(key) ?? null;
  }
  return null;
}

function buildOwnerIndex(
  points: readonly InfraspawnPointListItem[],
  sources: readonly { id: string; label: string }[],
): Map<string, { unitKey: string; displayName: string }> {
  const index = new Map<string, { unitKey: string; displayName: string }>();
  const { units } = inferAnleggsenheterFromPoints(points, sources);
  for (const unit of units) {
    const owner = { unitKey: unit.unitKey, displayName: unit.displayName };
    for (const point of filterPointsForAnleggsenhet(points, unit)) {
      index.set(catalogPointKey(point), owner);
    }
  }
  return index;
}

function resolveCategory(
  point: InfraspawnPointListItem,
  componentType: string | null,
  uiSlot: string | null,
): SdAnleggObjectCategory {
  if (!componentType && !uiSlot) return "unclassified";
  if (uiSlot) return "critical";
  if (
    componentType === "binary.status" ||
    /alarm|fault|status/i.test(point.description ?? "")
  ) {
    return "diagnostic";
  }
  return "secondary";
}

function resolveConfidence(
  point: InfraspawnPointListItem,
  uiSlot: string | null,
  componentType: string | null,
  fdvRole: string | null,
): SdAnleggMappingConfidence {
  if (uiSlot) return "high";
  if (componentType) return "medium";
  if (point.description?.trim() || fdvRole) return "medium";
  return "low";
}

export function buildSdAnleggObjectCatalog(input: {
  buildingName: string;
  buildingSlug: string;
  points: readonly InfraspawnPointListItem[];
  sources: readonly { id: string; label: string }[];
  elementKey?: string | null;
}): SdAnleggObjectCatalog {
  const elementKey = input.elementKey ?? null;
  const ventilationUiSlotByKey = buildVentilationUiSlotIndex(input.points, elementKey);
  const heatingUiSlotByKey = buildHeatingUiSlotIndex(input.points, elementKey);
  const ownerByKey = buildOwnerIndex(input.points, input.sources);

  const entries = input.points.map((point) => {
    const key = catalogPointKey(point);
    const domain = inferInfraspawnSystemDomain(point);
    const componentType = inferSdComponentTypeForPoint(point);
    const uiSlot = resolveUiSlotFromIndexes(
      point,
      ventilationUiSlotByKey,
      heatingUiSlotByKey,
    );
    const owner = ownerByKey.get(key) ?? { unitKey: "—", displayName: "Ugruppert" };
    const fdvRole = resolveFdvSignalRole({
      objectName: point.objectName,
      objectId: point.objectId,
      description: point.description,
    });
    const category = resolveCategory(point, componentType, uiSlot);
    const confidence = resolveConfidence(point, uiSlot, componentType, fdvRole);

    return {
      sourceId: point.sourceId,
      sourceLabel: point.sourceLabel,
      objectId: point.objectId,
      objectName: point.objectName,
      description: point.description,
      unit: point.unit,
      domain,
      ownerUnitKey: owner.unitKey,
      ownerDisplayName: owner.displayName,
      componentType,
      fdvRole,
      category,
      alarmRelevant:
        Boolean(point.statusInAlarm) ||
        category === "critical" ||
        /alarm|feil|fault|brann|pumpe/i.test(
          `${fdvRole ?? ""} ${point.description ?? ""}`,
        ),
      uiSlot,
      deepLinkReady: true,
      confidence,
      fdvDeviation:
        fdvRole && !uiSlot && category !== "unclassified"
          ? "FDV-rolle uten skjemaslot — verifiser mot live"
          : null,
    } satisfies SdAnleggObjectCatalogEntry;
  });

  entries.sort((a, b) => {
    const domainCmp = a.domain.localeCompare(b.domain, "nb");
    if (domainCmp !== 0) return domainCmp;
    return (a.objectName ?? a.objectId).localeCompare(
      b.objectName ?? b.objectId,
      "nb",
    );
  });

  return {
    entries,
    summary: summarizeSdComponentInference(input.points),
    buildingName: input.buildingName,
    buildingSlug: input.buildingSlug,
  };
}

export function catalogEntryForPoint(
  catalog: SdAnleggObjectCatalog,
  point: Pick<InfraspawnPointListItem, "sourceId" | "objectId">,
): SdAnleggObjectCatalogEntry | null {
  return (
    catalog.entries.find(
      (entry) =>
        entry.sourceId === point.sourceId && entry.objectId === point.objectId,
    ) ?? null
  );
}

export function catalogEntriesWithFdvDeviation(
  catalog: SdAnleggObjectCatalog,
): SdAnleggObjectCatalogEntry[] {
  return catalog.entries.filter((entry) => entry.fdvDeviation != null);
}
