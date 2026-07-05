import {
  pointMatchesInfraspawnSystemDomain,
  InfraspawnSystemDomain,
} from "@/lib/infraspawn/system-domain";
import { extractInfraspawnEquipmentCodes } from "@/lib/infraspawn/parse-point-ks-tag";
import { parseInfraspawnPointIdentity } from "@/lib/infraspawn/parse-infraspawn-point-identity";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { isVentilationSystemElementKey } from "@/lib/infraspawn/tfm-element-keys";
import { isHeatingOrTapWaterPoint } from "./ahu-point-eligibility";
import { isAhuProcessSettingsScopePoint } from "./ahu-process-settings";
import { extractAnleggsenhetUnitKeyFromPoint } from "./infer-anleggsenheter";
import { HEATING_DISTRICT_COMBINED_UNIT_KEY } from "./heating-process-units";
import { inferFallbackAnleggsenhetUnitKey } from "./infer-ventilation-unit-from-equipment";
import { scoreBindingRuleMatch } from "./schema-templates/match-binding-rule";
import type { SchemaTemplate } from "./schema-templates/types";

export function pointMatchesSchemaTemplate(
  point: InfraspawnPointListItem,
  template: SchemaTemplate,
  elementKey?: string | null,
): boolean {
  for (const node of template.nodes) {
    if (scoreBindingRuleMatch(point, node.bind, elementKey) > 0) {
      return true;
    }
  }
  return false;
}
export function expandPointsWithSharedEquipment(
  allPoints: readonly InfraspawnPointListItem[],
  anchorPoints: readonly InfraspawnPointListItem[],
): InfraspawnPointListItem[] {
  if (anchorPoints.length === 0) return [];

  const byObjectId = new Map(
    anchorPoints.map((point) => [point.objectId, point] as const),
  );
  const sourceIds = new Set(anchorPoints.map((point) => point.sourceId));
  const equipment = new Set<string>();

  for (const point of anchorPoints) {
    for (const code of extractInfraspawnEquipmentCodes(point)) {
      equipment.add(code);
    }
  }

  if (equipment.size === 0) {
    return [...byObjectId.values()];
  }

  for (const point of allPoints) {
    if (byObjectId.has(point.objectId)) continue;
    if (!sourceIds.has(point.sourceId)) continue;

    const codes = extractInfraspawnEquipmentCodes(point);
    if (codes.some((code) => equipment.has(code))) {
      byObjectId.set(point.objectId, point);
    }
  }

  return [...byObjectId.values()];
}

const TAP_WATER_ELEMENT_PREFIX = /^310\.001/i;
const BOLIG_HEATING_ELEMENT_KEYS = new Set(["320002", "3200002"]);

type TapWaterCircuitExpandScope = {
  elementKey?: string | null;
  unitKey?: string | null;
};

function shouldExpandTapWaterCircuit(
  scope?: string | null | TapWaterCircuitExpandScope,
): boolean {
  const normalized: TapWaterCircuitExpandScope =
    typeof scope === "string" || scope == null
      ? { elementKey: scope ?? null }
      : scope;

  if (normalized.unitKey === HEATING_DISTRICT_COMBINED_UNIT_KEY) {
    return true;
  }
  return Boolean(
    normalized.elementKey &&
      BOLIG_HEATING_ELEMENT_KEYS.has(normalized.elementKey),
  );
}
export function expandPointsWithTapWaterCircuit(
  allPoints: readonly InfraspawnPointListItem[],
  scopedPoints: readonly InfraspawnPointListItem[],
  scope?: string | null | TapWaterCircuitExpandScope,
): InfraspawnPointListItem[] {
  if (!shouldExpandTapWaterCircuit(scope)) {
    return [...scopedPoints];
  }

  const byObjectId = new Map(
    scopedPoints.map((point) => [point.objectId, point] as const),
  );
  const sourceIds = new Set(scopedPoints.map((point) => point.sourceId));

  for (const point of allPoints) {
    if (byObjectId.has(point.objectId)) continue;
    if (!sourceIds.has(point.sourceId)) continue;
    const name = point.objectName?.trim() ?? "";
    if (TAP_WATER_ELEMENT_PREFIX.test(name)) {
      byObjectId.set(point.objectId, point);
    }
  }

  return [...byObjectId.values()];
}
export function expandPointsWithVentilationUnitScope(
  allPoints: readonly InfraspawnPointListItem[],
  scopedPoints: readonly InfraspawnPointListItem[],
  elementKey?: string | null,
): InfraspawnPointListItem[] {
  if (!elementKey || !isVentilationSystemElementKey(elementKey)) {
    return [...scopedPoints];
  }

  const byObjectId = new Map(
    scopedPoints.map((point) => [point.objectId, point] as const),
  );
  const sourceIds = new Set(scopedPoints.map((point) => point.sourceId));
  const sourceLabel =
    scopedPoints.find((point) => point.sourceLabel?.trim())?.sourceLabel ?? "";

  for (const point of allPoints) {
    if (byObjectId.has(point.objectId)) continue;
    if (!sourceIds.has(point.sourceId)) continue;
    if (isHeatingOrTapWaterPoint(point)) continue;

    const prefixedKey = extractAnleggsenhetUnitKeyFromPoint(point);
    if (prefixedKey === elementKey) {
      byObjectId.set(point.objectId, point);
      continue;
    }

    const fallback = inferFallbackAnleggsenhetUnitKey(point, {
      sourceLabel: point.sourceLabel ?? sourceLabel,
    });
    if (fallback?.unitKey === elementKey) {
      byObjectId.set(point.objectId, point);
    }
  }

  return [...byObjectId.values()];
}
export function expandPointsWithAhuTemplateSchemaSignals(
  allPoints: readonly InfraspawnPointListItem[],
  scopedPoints: readonly InfraspawnPointListItem[],
  schemaTemplate: SchemaTemplate | null | undefined,
  elementKey?: string | null,
): InfraspawnPointListItem[] {
  if (
    !schemaTemplate ||
    !elementKey ||
    !isVentilationSystemElementKey(elementKey)
  ) {
    return [...scopedPoints];
  }

  if (schemaTemplate.nodes.length === 0) return [...scopedPoints];

  const byObjectId = new Map(
    scopedPoints.map((point) => [point.objectId, point] as const),
  );
  const sourceIds = new Set(scopedPoints.map((point) => point.sourceId));
  const ahuHeatingSchemaNodeIds = new Set([
    "heating.valve",
    "heating.cool_valve",
    "heating.temp",
  ]);

  for (const point of allPoints) {
    if (byObjectId.has(point.objectId)) continue;
    if (!sourceIds.has(point.sourceId)) continue;
    if (isHeatingOrTapWaterPoint(point)) continue;

    for (const node of schemaTemplate.nodes) {
      if (node.lane === "heating" && !ahuHeatingSchemaNodeIds.has(node.id)) {
        continue;
      }
      if (scoreBindingRuleMatch(point, node.bind, elementKey) > 0) {
        byObjectId.set(point.objectId, point);
        break;
      }
    }
  }

  return [...byObjectId.values()];
}
export function expandPointsWithAhuProcessSettingsSignals(
  allPoints: readonly InfraspawnPointListItem[],
  scopedPoints: readonly InfraspawnPointListItem[],
  elementKey?: string | null,
): InfraspawnPointListItem[] {
  if (!elementKey || !isVentilationSystemElementKey(elementKey)) {
    return [...scopedPoints];
  }
  if (scopedPoints.length === 0) return [];

  const byObjectId = new Map(
    scopedPoints.map((point) => [point.objectId, point] as const),
  );
  const sourceIds = new Set(scopedPoints.map((point) => point.sourceId));
  const sourceLabel =
    scopedPoints.find((point) => point.sourceLabel?.trim())?.sourceLabel ?? "";

  for (const point of allPoints) {
    if (byObjectId.has(point.objectId)) continue;
    if (!sourceIds.has(point.sourceId)) continue;
    if (isHeatingOrTapWaterPoint(point)) continue;
    if (!isAhuProcessSettingsScopePoint(point)) continue;

    const prefixedKey = extractAnleggsenhetUnitKeyFromPoint(point);
    if (prefixedKey === elementKey) {
      byObjectId.set(point.objectId, point);
      continue;
    }

    const fallback = inferFallbackAnleggsenhetUnitKey(point, {
      sourceLabel: point.sourceLabel ?? sourceLabel,
    });
    if (fallback?.unitKey === elementKey) {
      byObjectId.set(point.objectId, point);
      continue;
    }

    // Flate BACnet-kommandoer (DOSelect_SeqPumpY*) uten utstyrsprefix — samme kilde som enheten.
    if (!prefixedKey && !fallback) {
      byObjectId.set(point.objectId, point);
    }
  }

  return [...byObjectId.values()];
}

export function resolveSdAnleggWorkspacePoints(
  allPoints: readonly InfraspawnPointListItem[],
  options: {
    domain?: InfraspawnSystemDomain;
    unitObjectIds?: readonly string[];
    schemaTemplate?: SchemaTemplate | null;
    elementKey?: string | null;
    unitKey?: string | null;
  },
): InfraspawnPointListItem[] {
  let scoped = [...allPoints];

  if (options.unitObjectIds && options.unitObjectIds.length > 0) {
    const ids = new Set(options.unitObjectIds);
    const unitPoints = scoped.filter((point) => ids.has(point.objectId));
    scoped = expandPointsWithSharedEquipment(scoped, unitPoints);
    scoped = expandPointsWithTapWaterCircuit(allPoints, scoped, {
      elementKey: options.elementKey,
      unitKey: options.unitKey,
    });
    scoped = expandPointsWithVentilationUnitScope(
      allPoints,
      scoped,
      options.elementKey,
    );
    scoped = expandPointsWithAhuTemplateSchemaSignals(
      allPoints,
      scoped,
      options.schemaTemplate,
      options.elementKey,
    );
    scoped = expandPointsWithAhuProcessSettingsSignals(
      allPoints,
      scoped,
      options.elementKey,
    );
  }

  const domain = options.domain;
  if (!domain) return scoped;

  const schemaTemplate = options.schemaTemplate;
  const elementKey = options.elementKey;

  return scoped.filter((point) => {
    if (
      domain === InfraspawnSystemDomain.VENTILATION &&
      isHeatingOrTapWaterPoint(point)
    ) {
      return false;
    }
    if (pointMatchesInfraspawnSystemDomain(point, domain)) {
      return true;
    }
    if (
      schemaTemplate &&
      pointMatchesSchemaTemplate(point, schemaTemplate, elementKey)
    ) {
      return true;
    }
    if (
      domain === InfraspawnSystemDomain.VENTILATION &&
      elementKey &&
      isVentilationSystemElementKey(elementKey) &&
      isAhuProcessSettingsScopePoint(point)
    ) {
      return true;
    }
    return false;
  });
}

export function isInfraspawnSetpointSignal(point: {
  objectName?: string | null;
  description?: string | null;
}): boolean {
  const identity = parseInfraspawnPointIdentity(point);
  if (identity?.signalRole === "setpoint") {
    return true;
  }
  if (identity?.signalSuffix && /^(SP|SPK)$/i.test(identity.signalSuffix)) {
    return true;
  }
  const haystack = `${point.objectName ?? ""} ${point.description ?? ""}`;
  return /(?:^|[_-])(SP|SPK)\b/i.test(haystack) || /setpunkt/i.test(haystack);
}
