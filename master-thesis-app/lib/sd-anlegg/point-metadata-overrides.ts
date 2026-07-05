import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdAnleggsenhetPointAssignment } from "./anleggsenhet-point-assignments";
import {
  removeAnleggsenhetPointAssignment,
  upsertAnleggsenhetPointAssignment,
} from "./anleggsenhet-point-assignments";

export type SdAnleggPointMetadataOverride = {
  sourceId: string;
  objectId: string;
  objectName?: string;
  description?: string;
  subCentral?: string;
  scopeId?: string;
  schemaSlotId?: string;
};

function isPointMetadataOverride(
  value: unknown,
): value is SdAnleggPointMetadataOverride {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    typeof record.sourceId !== "string" ||
    typeof record.objectId !== "string" ||
    !record.sourceId.trim() ||
    !record.objectId.trim()
  ) {
    return false;
  }

  const optionalStringKeys = [
    "objectName",
    "description",
    "subCentral",
    "scopeId",
    "schemaSlotId",
  ] as const;

  for (const key of optionalStringKeys) {
    if (key in record && record[key] != null && typeof record[key] !== "string") {
      return false;
    }
  }

  return true;
}

function trimOptional(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function parsePointMetadataOverrides(
  raw: unknown,
): SdAnleggPointMetadataOverride[] {
  if (!Array.isArray(raw)) return [];

  const byKey = new Map<string, SdAnleggPointMetadataOverride>();

  for (const entry of raw) {
    if (!isPointMetadataOverride(entry)) continue;
    const key = `${entry.sourceId.trim()}:${entry.objectId.trim()}`;

    const normalized: SdAnleggPointMetadataOverride = {
      sourceId: entry.sourceId.trim(),
      objectId: entry.objectId.trim(),
    };

    const objectName = trimOptional(entry.objectName);
    const description = trimOptional(entry.description);
    const subCentral = trimOptional(entry.subCentral);
    const scopeId = trimOptional(entry.scopeId);
    const schemaSlotId = trimOptional(entry.schemaSlotId);

    if (objectName) normalized.objectName = objectName;
    if (description) normalized.description = description;
    if (subCentral) normalized.subCentral = subCentral;
    if (scopeId) normalized.scopeId = scopeId;
    if (schemaSlotId) normalized.schemaSlotId = schemaSlotId;

    byKey.set(key, normalized);
  }

  return [...byKey.values()];
}

export function pointMetadataOverrideKey(
  sourceId: string,
  objectId: string,
): string {
  return `${sourceId}:${objectId}`;
}

export function findPointMetadataOverride(
  overrides: readonly SdAnleggPointMetadataOverride[],
  point: Pick<InfraspawnPointListItem, "sourceId" | "objectId">,
): SdAnleggPointMetadataOverride | null {
  const key = pointMetadataOverrideKey(point.sourceId, point.objectId);
  return (
    overrides.find(
      (entry) =>
        pointMetadataOverrideKey(entry.sourceId, entry.objectId) === key,
    ) ?? null
  );
}

/** Sticky per felt: kun satt override-felt erstatter speilet. */
export function applyPointMetadataOverride(
  point: InfraspawnPointListItem,
  override: SdAnleggPointMetadataOverride | null,
): InfraspawnPointListItem {
  if (!override) return point;

  return {
    ...point,
    ...(override.objectName !== undefined
      ? { objectName: override.objectName }
      : {}),
    ...(override.description !== undefined
      ? { description: override.description }
      : {}),
  };
}

export function applyPointMetadataOverridesToList(
  points: readonly InfraspawnPointListItem[],
  overrides: readonly SdAnleggPointMetadataOverride[],
): InfraspawnPointListItem[] {
  if (overrides.length === 0) return [...points];

  const byKey = new Map<string, SdAnleggPointMetadataOverride>();
  for (const override of overrides) {
    byKey.set(
      pointMetadataOverrideKey(override.sourceId, override.objectId),
      override,
    );
  }

  return points.map((point) => {
    const override =
      byKey.get(pointMetadataOverrideKey(point.sourceId, point.objectId)) ??
      null;
    return applyPointMetadataOverride(point, override);
  });
}

export function resolveEffectiveSubCentral(
  point: Pick<InfraspawnPointListItem, "sourceId" | "objectId">,
  overrides: readonly SdAnleggPointMetadataOverride[],
): string | null {
  return findPointMetadataOverride(overrides, point)?.subCentral ?? null;
}

export function buildSchemaSlotOverrideMap(
  overrides: readonly SdAnleggPointMetadataOverride[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const override of overrides) {
    if (!override.schemaSlotId) continue;
    map.set(
      pointMetadataOverrideKey(override.sourceId, override.objectId),
      override.schemaSlotId,
    );
  }
  return map;
}

/** scopeId i metadata-override vinner over eldre assignments. */
export function resolveEffectiveAnleggsenhetAssignments(
  assignments: readonly SdAnleggsenhetPointAssignment[],
  overrides: readonly SdAnleggPointMetadataOverride[],
): SdAnleggsenhetPointAssignment[] {
  let effective = [...assignments];

  for (const override of overrides) {
    if (!override.scopeId) continue;
    effective = upsertAnleggsenhetPointAssignment(effective, {
      sourceId: override.sourceId,
      objectId: override.objectId,
      scopeId: override.scopeId,
    });
  }

  return effective;
}

export function upsertPointMetadataOverride(
  existing: readonly SdAnleggPointMetadataOverride[],
  patch: SdAnleggPointMetadataOverride,
): SdAnleggPointMetadataOverride[] {
  const key = pointMetadataOverrideKey(patch.sourceId, patch.objectId);
  const base =
    existing.find(
      (entry) => pointMetadataOverrideKey(entry.sourceId, entry.objectId) === key,
    ) ?? {
      sourceId: patch.sourceId.trim(),
      objectId: patch.objectId.trim(),
    };

  const merged: SdAnleggPointMetadataOverride = {
    sourceId: patch.sourceId.trim(),
    objectId: patch.objectId.trim(),
  };

  const objectName =
    patch.objectName !== undefined ? trimOptional(patch.objectName) : base.objectName;
  const description =
    patch.description !== undefined
      ? trimOptional(patch.description)
      : base.description;
  const subCentral =
    patch.subCentral !== undefined ? trimOptional(patch.subCentral) : base.subCentral;
  const scopeId =
    patch.scopeId !== undefined ? trimOptional(patch.scopeId) : base.scopeId;
  const schemaSlotId =
    patch.schemaSlotId !== undefined
      ? trimOptional(patch.schemaSlotId)
      : base.schemaSlotId;

  if (objectName) merged.objectName = objectName;
  if (description) merged.description = description;
  if (subCentral) merged.subCentral = subCentral;
  if (scopeId) merged.scopeId = scopeId;
  if (schemaSlotId) merged.schemaSlotId = schemaSlotId;

  const next = existing.filter(
    (entry) => pointMetadataOverrideKey(entry.sourceId, entry.objectId) !== key,
  );

  if (
    merged.objectName ||
    merged.description ||
    merged.subCentral ||
    merged.scopeId ||
    merged.schemaSlotId
  ) {
    next.push(merged);
  }

  return next;
}

export function removePointMetadataOverride(
  existing: readonly SdAnleggPointMetadataOverride[],
  sourceId: string,
  objectId: string,
): SdAnleggPointMetadataOverride[] {
  const key = pointMetadataOverrideKey(sourceId, objectId);
  return existing.filter(
    (entry) => pointMetadataOverrideKey(entry.sourceId, entry.objectId) !== key,
  );
}

export function resolvePointMetadataOverrideRemoval(
  existing: readonly SdAnleggPointMetadataOverride[],
  assignments: readonly SdAnleggsenhetPointAssignment[],
  sourceId: string,
  objectId: string,
): {
  pointMetadataOverrides: SdAnleggPointMetadataOverride[];
  anleggsenhetPointAssignments: SdAnleggsenhetPointAssignment[];
} {
  const removed = findPointMetadataOverride(existing, { sourceId, objectId });
  const pointMetadataOverrides = removePointMetadataOverride(
    existing,
    sourceId,
    objectId,
  );
  const anleggsenhetPointAssignments = removed?.scopeId
    ? removeAnleggsenhetPointAssignment(assignments, sourceId, objectId)
    : [...assignments];

  return { pointMetadataOverrides, anleggsenhetPointAssignments };
}

export function syncScopeAssignmentFromMetadataOverride(
  assignments: readonly SdAnleggsenhetPointAssignment[],
  override: SdAnleggPointMetadataOverride,
): SdAnleggsenhetPointAssignment[] {
  if (override.scopeId) {
    return upsertAnleggsenhetPointAssignment(assignments, {
      sourceId: override.sourceId,
      objectId: override.objectId,
      scopeId: override.scopeId,
    });
  }
  return removeAnleggsenhetPointAssignment(
    assignments,
    override.sourceId,
    override.objectId,
  );
}
