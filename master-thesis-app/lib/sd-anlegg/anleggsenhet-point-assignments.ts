import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import {
  buildAnleggsenhetScopeId,
  type SdAnleggsenhet,
} from "./infer-anleggsenheter";

export type SdAnleggsenhetPointAssignment = {
  sourceId: string;
  objectId: string;
  scopeId: string;
};

function isPointAssignment(value: unknown): value is SdAnleggsenhetPointAssignment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.sourceId === "string" &&
    typeof record.objectId === "string" &&
    typeof record.scopeId === "string" &&
    record.sourceId.trim().length > 0 &&
    record.objectId.trim().length > 0 &&
    record.scopeId.includes(":")
  );
}

export function parseAnleggsenhetPointAssignments(
  raw: unknown,
): SdAnleggsenhetPointAssignment[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: SdAnleggsenhetPointAssignment[] = [];
  for (const entry of raw) {
    if (!isPointAssignment(entry)) continue;
    const key = `${entry.sourceId}:${entry.objectId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      sourceId: entry.sourceId.trim(),
      objectId: entry.objectId.trim(),
      scopeId: entry.scopeId.trim(),
    });
  }
  return result;
}

function parseScopeId(scopeId: string): { sourceId: string; unitKey: string } | null {
  const separator = scopeId.indexOf(":");
  if (separator <= 0) return null;
  const sourceId = scopeId.slice(0, separator);
  const unitKey = scopeId.slice(separator + 1);
  if (!sourceId || !unitKey) return null;
  return { sourceId, unitKey };
}

/** Flytt enkeltpunkter til manuelt valgt anleggsenhet etter auto-inferanse. */
export function applyAnleggsenhetPointAssignments(
  units: readonly SdAnleggsenhet[],
  assignments: readonly SdAnleggsenhetPointAssignment[],
): SdAnleggsenhet[] {
  if (assignments.length === 0) return [...units];

  const assignmentByPoint = new Map<string, SdAnleggsenhetPointAssignment>();
  for (const assignment of assignments) {
    assignmentByPoint.set(
      `${assignment.sourceId}:${assignment.objectId}`,
      assignment,
    );
  }

  const objectIdsByUnitId = new Map<string, Set<string>>();
  for (const unit of units) {
    objectIdsByUnitId.set(unit.id, new Set(unit.objectIds));
  }

  for (const unit of units) {
    for (const objectId of unit.objectIds) {
      const assignment = assignmentByPoint.get(`${unit.sourceId}:${objectId}`);
      if (!assignment) continue;
      const target = parseScopeId(assignment.scopeId);
      if (!target || target.sourceId !== unit.sourceId) continue;
      const targetId = buildAnleggsenhetScopeId(target.sourceId, target.unitKey);
      if (targetId === unit.id) continue;

      objectIdsByUnitId.get(unit.id)?.delete(objectId);
      const targetBucket = objectIdsByUnitId.get(targetId) ?? new Set<string>();
      targetBucket.add(objectId);
      objectIdsByUnitId.set(targetId, targetBucket);
    }
  }

  const rebuilt: SdAnleggsenhet[] = [];
  for (const unit of units) {
    const objectIds = [...(objectIdsByUnitId.get(unit.id) ?? [])];
    if (objectIds.length === 0 && unit.unitKey !== "__ungrouped__") continue;
    rebuilt.push({
      ...unit,
      objectIds,
      pointCount: objectIds.length,
    });
  }

  for (const assignment of assignments) {
    const target = parseScopeId(assignment.scopeId);
    if (!target) continue;
    const targetId = buildAnleggsenhetScopeId(target.sourceId, target.unitKey);
    if (rebuilt.some((unit) => unit.id === targetId)) continue;
    rebuilt.push({
      id: targetId,
      unitKey: target.unitKey,
      sourceId: target.sourceId,
      sourceLabel:
        units.find((unit) => unit.sourceId === target.sourceId)?.sourceLabel ??
        target.sourceId,
      displayName: target.unitKey,
      slug: target.unitKey,
      pointCount: 1,
      primaryDomain: units[0]?.primaryDomain ?? InfraspawnSystemDomain.VENTILATION,
      detectionConfidence: "medium",
      detectionMethod: "ungrouped",
      objectIds: [assignment.objectId],
    });
  }

  return rebuilt.sort((a, b) => a.displayName.localeCompare(b.displayName, "nb"));
}

export function upsertAnleggsenhetPointAssignment(
  existing: readonly SdAnleggsenhetPointAssignment[],
  assignment: SdAnleggsenhetPointAssignment,
): SdAnleggsenhetPointAssignment[] {
  const key = `${assignment.sourceId}:${assignment.objectId}`;
  const next = existing.filter(
    (entry) => `${entry.sourceId}:${entry.objectId}` !== key,
  );
  next.push(assignment);
  return next;
}

export function removeAnleggsenhetPointAssignment(
  existing: readonly SdAnleggsenhetPointAssignment[],
  sourceId: string,
  objectId: string,
): SdAnleggsenhetPointAssignment[] {
  const key = `${sourceId}:${objectId}`;
  return existing.filter(
    (entry) => `${entry.sourceId}:${entry.objectId}` !== key,
  );
}

export function findAssignedScopeId(
  assignments: readonly SdAnleggsenhetPointAssignment[],
  point: Pick<InfraspawnPointListItem, "sourceId" | "objectId">,
): string | null {
  return (
    assignments.find(
      (entry) =>
        entry.sourceId === point.sourceId && entry.objectId === point.objectId,
    )?.scopeId ?? null
  );
}
