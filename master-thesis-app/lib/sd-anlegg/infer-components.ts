import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  getSdComponentDefinition,
  scoreSdComponentMatch,
  SD_COMPONENT_REGISTRY,
  type SdComponentDefinition,
} from "./component-registry";
import type { SdComponentType } from "./component-types";

export type SdInferredComponentInstance = {
  objectId: string;
  sourceId: string;
  componentType: SdComponentType;
  score: number;
  label: string;
};

const MIN_INFERENCE_SCORE = 2;

function inferComponentTypeForPoint(
  point: Pick<
    InfraspawnPointListItem,
    "objectId" | "objectName" | "description" | "unit"
  >,
): { type: SdComponentType; score: number; definition: SdComponentDefinition } | null {
  let best: {
    type: SdComponentType;
    score: number;
    definition: SdComponentDefinition;
  } | null = null;

  for (const definition of SD_COMPONENT_REGISTRY) {
    const score = scoreSdComponentMatch(definition, point);
    if (score < MIN_INFERENCE_SCORE) continue;
    if (!best || score > best.score) {
      best = {
        type: definition.type,
        score,
        definition,
      };
    }
  }

  return best;
}

export function inferSdComponentInstances(
  points: readonly InfraspawnPointListItem[],
): SdInferredComponentInstance[] {
  return points.flatMap((point) => {
    const match = inferComponentTypeForPoint(point);
    if (!match) return [];
    return [
      {
        objectId: point.objectId,
        sourceId: point.sourceId,
        componentType: match.type,
        score: match.score,
        label: getSdComponentDefinition(match.type)?.label ?? match.type,
      },
    ];
  });
}

export function inferSdComponentTypeForPoint(
  point: Pick<
    InfraspawnPointListItem,
    "objectId" | "objectName" | "description" | "unit"
  >,
): SdComponentType | null {
  return inferComponentTypeForPoint(point)?.type ?? null;
}

export function summarizeSdComponentInference(
  points: readonly InfraspawnPointListItem[],
): {
  total: number;
  inferred: number;
  coveragePct: number;
  byType: Record<string, number>;
} {
  const inferred = inferSdComponentInstances(points);
  const byType: Record<string, number> = {};
  for (const entry of inferred) {
    byType[entry.componentType] = (byType[entry.componentType] ?? 0) + 1;
  }
  const total = points.length;
  const coveragePct = total > 0 ? Math.round((inferred.length / total) * 100) : 0;
  return {
    total,
    inferred: inferred.length,
    coveragePct,
    byType,
  };
}
