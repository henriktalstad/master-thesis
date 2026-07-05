import { SD_ANLEGG_INITIAL_TAIL_MAX_OBJECT_IDS } from "@/lib/infraspawn/live-display-policy";
import { resolveDashboardPriorityObjectIds } from "@/lib/infraspawn/resolve-dashboard-priority-object-ids";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { inferAnleggsenheterFromPoints } from "@/lib/sd-anlegg/infer-anleggsenheter";
import type { WorkspaceLiveScopeInput } from "@/lib/sd-anlegg/resolve-workspace-live-points";

type SourceRef = { id: string; label: string };

export function resolveInitialPaintTailObjectIds(input: {
  points: readonly InfraspawnPointListItem[];
  sources: readonly SourceRef[];
  workspaceScope?: WorkspaceLiveScopeInput;
  extraTailObjectIds?: readonly string[];
  priorityObjectIds?: readonly string[];
  scopedPoints?: readonly InfraspawnPointListItem[];
}): string[] {
  const scopedIdSet = input.scopedPoints
    ? new Set(input.scopedPoints.map((point) => point.objectId))
    : null;

  const ids = new Set<string>();

  for (const objectId of input.priorityObjectIds ?? []) {
    if (!scopedIdSet || scopedIdSet.has(objectId)) {
      ids.add(objectId);
    }
  }

  for (const objectId of resolveDashboardPriorityObjectIds(input.points)) {
    ids.add(objectId);
  }

  for (const objectId of input.extraTailObjectIds ?? []) {
    ids.add(objectId);
  }

  for (const objectId of input.workspaceScope?.unitObjectIds ?? []) {
    ids.add(objectId);
  }

  const { units } = inferAnleggsenheterFromPoints(input.points, input.sources);
  for (const unit of units) {
    for (const objectId of unit.objectIds) {
      ids.add(objectId);
      if (ids.size >= SD_ANLEGG_INITIAL_TAIL_MAX_OBJECT_IDS) {
        return [...ids];
      }
    }
  }

  return [...ids].slice(0, SD_ANLEGG_INITIAL_TAIL_MAX_OBJECT_IDS);
}
