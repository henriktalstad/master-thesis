import { parseInfraspawnTfmIdentity } from "@/lib/infraspawn/parse-infraspawn-tfm-identity";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export type ResolvedAlarmThreshold = {
  value: number;
  unit: string | null;
  /** Hvor terskelen kom fra — brukes kun internt / a11y. */
  source: "metadata" | "setpoint";
  setpointObjectId?: string;
};

function thresholdFromMetadata(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  for (const key of [
    "threshold",
    "thresholdValue",
    "limitValue",
    "alarmLimit",
    "setpoint",
  ]) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function alarmObjectBase(objectId: string): string | null {
  const trimmed = objectId.trim();
  const match = trimmed.match(/^(.+)_(MV|PV|CV|AV|SP|SPK|RP|TP|TT|OT)$/i);
  if (match) return match[1]!;
  return null;
}

function setpointObjectIdCandidates(base: string): string[] {
  return [`${base}_SP`, `${base}_SPK`, `${base}SP`, `${base.replace(/\./g, "")}_SP`];
}

function sameSourcePoint(
  point: InfraspawnPointListItem,
  sourceId: string,
): boolean {
  return point.sourceId === sourceId;
}

function findSetpointPoint(
  sourceId: string,
  alarmObjectId: string,
  points: readonly InfraspawnPointListItem[],
): InfraspawnPointListItem | null {
  const base = alarmObjectBase(alarmObjectId);
  if (!base) return null;

  const sourcePoints = points.filter((point) => sameSourcePoint(point, sourceId));

  for (const candidateId of setpointObjectIdCandidates(base)) {
    const exact = sourcePoints.find((point) => point.objectId === candidateId);
    if (exact?.lastValue != null && !Number.isNaN(exact.lastValue)) return exact;
  }

  const baseNormalized = base.replace(/\./g, "").toLowerCase();
  for (const point of sourcePoints) {
    if (point.objectId === alarmObjectId) continue;
    if (point.lastValue == null || Number.isNaN(point.lastValue)) continue;

    const objectHaystack = `${point.objectId} ${point.objectName ?? ""} ${
      point.description ?? ""
    }`.toLowerCase();
    if (!objectHaystack.includes(baseNormalized.slice(-6))) continue;

    const identity = parseInfraspawnTfmIdentity({
      objectName: point.objectName,
      description: point.description,
    });
    if (identity?.signalRole === "setpoint") return point;
  }

  return null;
}

export function resolveAlarmThreshold(input: {
  sourceId: string;
  objectId: string;
  unit: string | null;
  metadata: unknown;
  livePoints?: readonly InfraspawnPointListItem[];
}): ResolvedAlarmThreshold | null {
  const fromMetadata = thresholdFromMetadata(input.metadata);
  if (fromMetadata != null) {
    return {
      value: fromMetadata,
      unit: input.unit,
      source: "metadata",
    };
  }

  if (!input.livePoints?.length) return null;

  const setpoint = findSetpointPoint(
    input.sourceId,
    input.objectId,
    input.livePoints,
  );
  if (
    !setpoint ||
    setpoint.lastValue == null ||
    Number.isNaN(setpoint.lastValue)
  ) {
    return null;
  }

  return {
    value: setpoint.lastValue,
    unit: setpoint.unit ?? input.unit,
    source: "setpoint",
    setpointObjectId: setpoint.objectId,
  };
}
