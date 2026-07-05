import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { infraspawnPointHaystack } from "@/lib/infraspawn/point-haystack";
import { parseInfraspawnPointIdentity } from "@/lib/infraspawn/parse-infraspawn-point-identity";
import {
  formatTfmElementKeyForDisplay,
  isSdAnleggsenhetElementKey,
  isVentilationSystemElementKey,
} from "@/lib/infraspawn/tfm-element-keys";
import { formatAnleggsenhetDisplay, inferAnleggsenhetDescriptiveName } from "./anleggsenhet-display";
import {
  inferFallbackAnleggsenhetUnitKey,
  inferVentilationBootstrapUnitKey,
  pickDominantVentilationUnitKey,
} from "./infer-ventilation-unit-from-equipment";
import { applyAnleggsenhetPointAssignments } from "./anleggsenhet-point-assignments";
import type { SdAnleggsenhetPointAssignment } from "./anleggsenhet-point-assignments";
import {
  inferInfraspawnSystemDomain,
  type InfraspawnSystemDomain,
} from "@/lib/infraspawn/system-domain";
import { InfraspawnSystemDomain as InfraspawnSystemDomainEnum } from "@/generated/client/enums";

export const SD_ANLEGG_SOURCE_UNIT_KEY = "__source__";

export const SD_ANLEGG_UNGROUPED_UNIT_KEY = "__ungrouped__";

export type SdAnleggsenhetDetectionConfidence = "high" | "medium" | "low";

export type SdAnleggsenhetDetectionMethod =
  | "source"
  | "prefix"
  | "equipment_band"
  | "bacnet_role"
  | "ungrouped";

export type SdAnleggsenhet = {
  id: string;
  unitKey: string;
  sourceId: string;
  sourceLabel: string;
  displayName: string;
  slug: string;
  pointCount: number;
  primaryDomain: InfraspawnSystemDomain;
  detectionConfidence: SdAnleggsenhetDetectionConfidence;
  detectionMethod: SdAnleggsenhetDetectionMethod;
  objectIds: readonly string[];
};

export type SdAnleggsenhetSummary = Omit<SdAnleggsenhet, "objectIds">;

export type SdAnleggsenhetInferenceResult = {
  units: SdAnleggsenhet[];
  ungroupedPointCount: number;
};

type PointHaystackInput = Pick<
  InfraspawnPointListItem,
  "objectId" | "objectName" | "description" | "unit"
>;

const PREFIX_MATCH_THRESHOLD = 0.6;
const UNGROUPED_UNIT_THRESHOLD = 0.15;
const AHU_STATUS_HAYSTACK =
  /systemstatus|frostvakt|frostrisk|\bsfp\b|unitmode|airunitautomode|supplypid|supplysetpoint|extractsetpoint|tidsprogram|timeschedule|automode|plantmode|forlenget|calculatedvalue|kalkulert|firealarm|smokedetector|sumalarm|brannalarm/i;

const TAP_WATER_ELEMENT_PREFIX = /^310\.001/i;
const BOLIG_HEATING_UNIT_KEY = "320002";

const OBJECT_NAME_BLOCK_PREFIX = /^(360[.\s]?\d{3})_/i;
const HAYSTACK_360_BLOCK = /\b(360[.\s]?\d{3})\b/gi;

export function normalizeAnleggsenhetUnitKey(raw: string): string {
  return raw.replace(/[.\s]/g, "").toLowerCase();
}

export function formatAnleggsenhetUnitKeyForDisplay(unitKey: string): string {
  if (unitKey === SD_ANLEGG_SOURCE_UNIT_KEY || unitKey === SD_ANLEGG_UNGROUPED_UNIT_KEY) {
    return unitKey;
  }
  if (/^\d{6,7}$/.test(unitKey)) {
    return formatTfmElementKeyForDisplay(unitKey);
  }
  return unitKey;
}

function isAnleggsenhetBlockKey(unitKey: string): boolean {
  return isSdAnleggsenhetElementKey(unitKey);
}

export function extractAnleggsenhetUnitKeyFromPoint(
  point: PointHaystackInput,
): string | null {
  const identity = parseInfraspawnPointIdentity({
    objectName: point.objectName,
    description: point.description,
    sourceLabel: ""
  });
  if (identity && isAnleggsenhetBlockKey(identity.elementKey)) {
    return identity.elementKey;
  }

  const candidates: string[] = [];

  const objectName = point.objectName?.trim();
  if (objectName) {
    const underscoreMatch = OBJECT_NAME_BLOCK_PREFIX.exec(objectName);
    if (underscoreMatch?.[1]) {
      candidates.push(underscoreMatch[1]);
    }
  }

  const haystack = infraspawnPointHaystack(point);
  for (const match of haystack.matchAll(HAYSTACK_360_BLOCK)) {
    if (match[1]) candidates.push(match[1]);
  }

  if (candidates.length === 0) return null;

  const normalized = normalizeAnleggsenhetUnitKey(candidates[0]!);
  return isAnleggsenhetBlockKey(normalized) ? normalized : null;
}

export function buildAnleggsenhetScopeId(
  sourceId: string,
  unitKey: string,
): string {
  return `${sourceId}:${unitKey}`;
}

export function parseAnleggsenhetScopeId(
  scopeId: string,
): { sourceId: string; unitKey: string } | null {
  const separator = scopeId.indexOf(":");
  if (separator <= 0 || separator >= scopeId.length - 1) return null;
  return {
    sourceId: scopeId.slice(0, separator),
    unitKey: scopeId.slice(separator + 1),
  };
}

export function anleggsenhetSlug(unitKey: string, sourceId: string): string {
  if (unitKey === SD_ANLEGG_SOURCE_UNIT_KEY) {
    return `kilde-${sourceId}`;
  }
  if (unitKey === SD_ANLEGG_UNGROUPED_UNIT_KEY) {
    return `ugruppert-${sourceId}`;
  }
  return unitKey;
}

function resolvePrimaryDomain(
  points: readonly InfraspawnPointListItem[],
): InfraspawnSystemDomain {
  const counts = new Map<InfraspawnSystemDomain, number>();
  for (const point of points) {
    const domain = inferInfraspawnSystemDomain(point);
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  let best: InfraspawnSystemDomain = InfraspawnSystemDomainEnum.OTHER;
  let bestCount = 0;
  for (const [domain, count] of counts) {
    if (count > bestCount) {
      best = domain;
      bestCount = count;
    }
  }
  return best;
}

function buildDisplayName(
  sourceLabel: string,
  unitKey: string,
): string {
  if (unitKey === SD_ANLEGG_UNGROUPED_UNIT_KEY) {
    const source = sourceLabel.trim();
    return source ? `Ugruppert · ${source}` : "Ugruppert";
  }
  return formatAnleggsenhetDisplay(
    unitKey,
    inferAnleggsenhetDescriptiveName({ unitKey, sourceLabel }),
  );
}

function resolveDetectionMethod(
  unitKey: string,
  points: readonly InfraspawnPointListItem[],
  sourceLabel: string,
): SdAnleggsenhetDetectionMethod {
  if (unitKey === SD_ANLEGG_SOURCE_UNIT_KEY) return "source";
  if (unitKey === SD_ANLEGG_UNGROUPED_UNIT_KEY) return "ungrouped";

  const hasEquipmentBandPrefix = points.some((point) => {
    const objectName = point.objectName?.trim() ?? "";
    return (
      OBJECT_NAME_BLOCK_PREFIX.test(objectName) ||
      (parseInfraspawnPointIdentity({
        objectName: point.objectName,
        description: point.description,
        sourceLabel: "",
      })?.elementKey === unitKey)
    );
  });
  if (hasEquipmentBandPrefix) return "prefix";

  const hasEquipmentBand = points.some(
    (point) =>
      inferFallbackAnleggsenhetUnitKey(point, { sourceLabel })?.method ===
      "equipment_band",
  );
  if (hasEquipmentBand) return "equipment_band";

  return "bacnet_role";
}

function toUnit(input: {
  sourceId: string;
  sourceLabel: string;
  unitKey: string;
  points: readonly InfraspawnPointListItem[];
  detectionConfidence: SdAnleggsenhetDetectionConfidence;
  detectionMethod?: SdAnleggsenhetDetectionMethod;
}): SdAnleggsenhet {
  const objectIds = input.points.map((point) => point.objectId);
  const detectionMethod =
    input.detectionMethod ??
    resolveDetectionMethod(input.unitKey, input.points, input.sourceLabel);
  return {
    id: buildAnleggsenhetScopeId(input.sourceId, input.unitKey),
    unitKey: input.unitKey,
    sourceId: input.sourceId,
    sourceLabel: input.sourceLabel,
    displayName: buildDisplayName(input.sourceLabel, input.unitKey),
    slug: anleggsenhetSlug(input.unitKey, input.sourceId),
    pointCount: input.points.length,
    primaryDomain: resolvePrimaryDomain(input.points),
    detectionConfidence: input.detectionConfidence,
    detectionMethod,
    objectIds,
  };
}

function assignPointToKeyed(
  keyed: Map<string, InfraspawnPointListItem[]>,
  unitKey: string,
  point: InfraspawnPointListItem,
) {
  const bucket = keyed.get(unitKey) ?? [];
  bucket.push(point);
  keyed.set(unitKey, bucket);
}

function assignTapWaterPointsToBolig(
  keyed: Map<string, InfraspawnPointListItem[]>,
  noKey: InfraspawnPointListItem[],
) {
  if (!keyed.has(BOLIG_HEATING_UNIT_KEY)) return;

  for (let index = noKey.length - 1; index >= 0; index -= 1) {
    const point = noKey[index]!;
    const name = point.objectName?.trim() ?? "";
    if (!TAP_WATER_ELEMENT_PREFIX.test(name)) continue;
    noKey.splice(index, 1);
    assignPointToKeyed(keyed, BOLIG_HEATING_UNIT_KEY, point);
  }
}

function shouldMergeOrphanIntoUnit(
  point: InfraspawnPointListItem,
  targetUnitKey: string,
): boolean {
  if (!isVentilationSystemElementKey(targetUnitKey)) return true;
  return (
    inferInfraspawnSystemDomain(point) !== InfraspawnSystemDomainEnum.HEATING
  );
}

function resolveOrphanPointsForSource(
  keyed: Map<string, InfraspawnPointListItem[]>,
  noKey: InfraspawnPointListItem[],
  sourceLabel: string,
): void {
  let changed = true;
  while (changed && noKey.length > 0) {
    changed = false;
    const dominantVentilationUnitKey =
      pickDominantVentilationUnitKey(keyed) ??
      inferVentilationBootstrapUnitKey({
        keyedUnitKeys: [...keyed.keys()],
        orphanPoints: noKey,
      });

    for (let index = noKey.length - 1; index >= 0; index -= 1) {
      const point = noKey[index]!;
      const fallback = inferFallbackAnleggsenhetUnitKey(point, {
        sourceLabel,
        dominantVentilationUnitKey,
      });
      if (fallback) {
        noKey.splice(index, 1);
        assignPointToKeyed(keyed, fallback.unitKey, point);
        changed = true;
      }
    }

    const dominant = pickDominantVentilationUnitKey(keyed);
    if (!dominant) continue;

    for (let index = noKey.length - 1; index >= 0; index -= 1) {
      const point = noKey[index]!;
      if (AHU_STATUS_HAYSTACK.test(infraspawnPointHaystack(point))) {
        noKey.splice(index, 1);
        assignPointToKeyed(keyed, dominant, point);
        changed = true;
      }
    }
  }
}

function shouldPreferMergeOverUngroupedUnit(
  noKey: readonly InfraspawnPointListItem[],
  targetUnitKey: string,
): boolean {
  if (!isVentilationSystemElementKey(targetUnitKey)) return false;
  if (noKey.length === 0) return false;
  return noKey.every(
    (point) =>
      shouldMergeOrphanIntoUnit(point, targetUnitKey) &&
      (AHU_STATUS_HAYSTACK.test(infraspawnPointHaystack(point)) ||
        inferInfraspawnSystemDomain(point) === InfraspawnSystemDomainEnum.VENTILATION),
  );
}

function inferUnitsForSource(
  sourceId: string,
  sourceLabel: string,
  sourcePoints: readonly InfraspawnPointListItem[],
): { units: SdAnleggsenhet[]; ungroupedPointCount: number } {
  const keyed = new Map<string, InfraspawnPointListItem[]>();
  const noKey: InfraspawnPointListItem[] = [];

  for (const point of sourcePoints) {
    let unitKey = extractAnleggsenhetUnitKeyFromPoint(point);
    if (!unitKey) {
      const equipment = inferFallbackAnleggsenhetUnitKey(point, { sourceLabel });
      if (equipment?.method === "equipment_band") {
        unitKey = equipment.unitKey;
      }
    }
    if (unitKey) {
      assignPointToKeyed(keyed, unitKey, point);
    } else {
      noKey.push(point);
    }
  }

  assignTapWaterPointsToBolig(keyed, noKey);
  resolveOrphanPointsForSource(keyed, noKey, sourceLabel);

  if (keyed.size === 0) {
    return {
      units: [
        toUnit({
          sourceId,
          sourceLabel,
          unitKey: SD_ANLEGG_SOURCE_UNIT_KEY,
          points: sourcePoints,
          detectionConfidence: "high",
          detectionMethod: "source",
        }),
      ],
      ungroupedPointCount: 0,
    };
  }

  const units: SdAnleggsenhet[] = [];
  let ungroupedPointCount = 0;

  if (keyed.size === 1) {
    const [unitKey, matched] = [...keyed.entries()][0]!;
    const prefixRatio = matched.length / sourcePoints.length;
    const ungroupedRatio = noKey.length / sourcePoints.length;

    if (
      noKey.length > 0 &&
      shouldPreferMergeOverUngroupedUnit(noKey, unitKey)
    ) {
      units.push(
        toUnit({
          sourceId,
          sourceLabel,
          unitKey,
          points: [...matched, ...noKey],
          detectionConfidence:
            prefixRatio >= PREFIX_MATCH_THRESHOLD ? "high" : "medium",
        }),
      );
      return { units, ungroupedPointCount: 0 };
    }

    const shouldCreateUngroupedUnit =
      noKey.length >= 3 ||
      (ungroupedRatio >= UNGROUPED_UNIT_THRESHOLD && noKey.length >= 2);

    if (shouldCreateUngroupedUnit && noKey.length > 0) {
      units.push(
        toUnit({
          sourceId,
          sourceLabel,
          unitKey,
          points: matched,
          detectionConfidence: prefixRatio >= PREFIX_MATCH_THRESHOLD ? "high" : "medium",
        }),
      );
      units.push(
        toUnit({
          sourceId,
          sourceLabel,
          unitKey: SD_ANLEGG_UNGROUPED_UNIT_KEY,
          points: noKey,
          detectionConfidence: "low",
          detectionMethod: "ungrouped",
        }),
      );
      return { units, ungroupedPointCount: noKey.length };
    }

    const confidence: SdAnleggsenhetDetectionConfidence =
      noKey.length === 0
        ? "high"
        : prefixRatio >= PREFIX_MATCH_THRESHOLD
          ? "high"
          : "medium";

    const mergeableNoKey = noKey.filter((point) =>
      shouldMergeOrphanIntoUnit(point, unitKey),
    );
    const remainingNoKey = noKey.filter(
      (point) => !mergeableNoKey.includes(point),
    );

    units.push(
      toUnit({
        sourceId,
        sourceLabel,
        unitKey,
        points: [...matched, ...mergeableNoKey],
        detectionConfidence: confidence,
      }),
    );

    if (
      remainingNoKey.length > 0 &&
      shouldPreferMergeOverUngroupedUnit(remainingNoKey, unitKey)
    ) {
      const index = units.length - 1;
      units[index] = toUnit({
        sourceId,
        sourceLabel,
        unitKey,
        points: [...matched, ...noKey],
        detectionConfidence: confidence,
      });
      return { units, ungroupedPointCount: 0 };
    }

    if (remainingNoKey.length > 0) {
      ungroupedPointCount = remainingNoKey.length;
      units.push(
        toUnit({
          sourceId,
          sourceLabel,
          unitKey: SD_ANLEGG_UNGROUPED_UNIT_KEY,
          points: remainingNoKey,
          detectionConfidence: "low",
          detectionMethod: "ungrouped",
        }),
      );
    }

    return { units, ungroupedPointCount };
  }

  for (const [unitKey, matched] of keyed) {
    const share = matched.length / sourcePoints.length;
    units.push(
      toUnit({
        sourceId,
        sourceLabel,
        unitKey,
        points: matched,
        detectionConfidence: share >= PREFIX_MATCH_THRESHOLD ? "high" : "medium",
      }),
    );
  }

  if (noKey.length > 0) {
    const ungroupedRatio = noKey.length / sourcePoints.length;
    const shouldCreateUngroupedUnit =
      noKey.length >= 3 ||
      (ungroupedRatio >= UNGROUPED_UNIT_THRESHOLD && noKey.length >= 2);

    if (shouldCreateUngroupedUnit) {
      units.push(
        toUnit({
          sourceId,
          sourceLabel,
          unitKey: SD_ANLEGG_UNGROUPED_UNIT_KEY,
          points: noKey,
          detectionConfidence: "low",
          detectionMethod: "ungrouped",
        }),
      );
      ungroupedPointCount = noKey.length;
    } else {
      const largest = [...units].sort((a, b) => b.pointCount - a.pointCount)[0];
      if (largest) {
        const mergeableNoKey = noKey.filter((point) =>
          shouldMergeOrphanIntoUnit(point, largest.unitKey),
        );
        const remainingNoKey = noKey.filter(
          (point) => !mergeableNoKey.includes(point),
        );
        if (mergeableNoKey.length > 0) {
          const mergedPoints = [
            ...sourcePoints.filter((point) =>
              largest.objectIds.includes(point.objectId),
            ),
            ...mergeableNoKey,
          ];
          const index = units.findIndex((unit) => unit.id === largest.id);
          units[index] = toUnit({
            sourceId,
            sourceLabel,
            unitKey: largest.unitKey,
            points: mergedPoints,
            detectionConfidence: "medium",
          });
        }
        if (remainingNoKey.length > 0) {
          ungroupedPointCount = remainingNoKey.length;
          if (
            remainingNoKey.length >= 3 ||
            (remainingNoKey.length / sourcePoints.length >=
              UNGROUPED_UNIT_THRESHOLD &&
              remainingNoKey.length >= 2)
          ) {
            units.push(
              toUnit({
                sourceId,
                sourceLabel,
                unitKey: SD_ANLEGG_UNGROUPED_UNIT_KEY,
                points: remainingNoKey,
                detectionConfidence: "low",
                detectionMethod: "ungrouped",
              }),
            );
          }
        }
      }
    }
  }

  return { units, ungroupedPointCount };
}

export function inferAnleggsenheterFromPoints(
  points: readonly InfraspawnPointListItem[],
  sources: readonly { id: string; label: string }[] = [],
  options: {
    pointAssignments?: readonly SdAnleggsenhetPointAssignment[];
  } = {},
): SdAnleggsenhetInferenceResult {
  const sourceLabels = new Map(sources.map((source) => [source.id, source.label]));
  const bySource = groupPointsBySource(points);

  const units: SdAnleggsenhet[] = [];
  let ungroupedPointCount = 0;

  for (const source of sources) {
    const sourcePoints = bySource.get(source.id) ?? [];
    if (sourcePoints.length === 0) continue;

    const result = inferUnitsForSource(
      source.id,
      sourceLabels.get(source.id) ?? source.label,
      sourcePoints,
    );
    units.push(...result.units);
    ungroupedPointCount += result.ungroupedPointCount;
  }

  for (const [sourceId, sourcePoints] of bySource) {
    if (sourceLabels.has(sourceId)) continue;
    const result = inferUnitsForSource(
      sourceId,
      sourcePoints[0]?.sourceLabel ?? sourceId,
      sourcePoints,
    );
    units.push(...result.units);
    ungroupedPointCount += result.ungroupedPointCount;
  }

  return {
    units: applyAnleggsenhetPointAssignments(
      units.sort((a, b) => a.displayName.localeCompare(b.displayName, "nb")),
      options.pointAssignments ?? [],
    ),
    ungroupedPointCount,
  };
}

export function summarizeAnleggsenheter(
  units: readonly SdAnleggsenhet[],
): SdAnleggsenhetSummary[] {
  return units.map(({ objectIds: _objectIds, ...summary }) => summary);
}

export function filterPointsForAnleggsenhet(
  points: readonly InfraspawnPointListItem[],
  unit: Pick<SdAnleggsenhet, "sourceId" | "objectIds">,
): InfraspawnPointListItem[] {
  const objectIds = new Set(unit.objectIds);
  return points.filter(
    (point) => point.sourceId === unit.sourceId && objectIds.has(point.objectId),
  );
}

export function findAnleggsenhetBySlug(
  units: readonly SdAnleggsenhet[],
  slug: string,
): SdAnleggsenhet | null {
  return units.find((unit) => unit.slug === slug) ?? null;
}

function groupPointsBySource(
  points: readonly InfraspawnPointListItem[],
): Map<string, InfraspawnPointListItem[]> {
  const map = new Map<string, InfraspawnPointListItem[]>();
  for (const point of points) {
    const bucket = map.get(point.sourceId) ?? [];
    bucket.push(point);
    map.set(point.sourceId, bucket);
  }
  return map;
}
