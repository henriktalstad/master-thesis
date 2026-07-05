import {
  SD_ANLEGG_POLL_TAIL_MAX_OBJECT_IDS,
} from "@/lib/infraspawn/live-display-policy";
import { resolveDashboardPriorityObjectIds } from "@/lib/infraspawn/resolve-dashboard-priority-object-ids";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { WorkspaceLiveScopeInput } from "@/lib/sd-anlegg/resolve-workspace-live-points";

export function resolvePollTailObjectIds(input: {
  points: readonly InfraspawnPointListItem[];
  scopedPoints?: readonly InfraspawnPointListItem[];
  workspaceScope?: WorkspaceLiveScopeInput;
  priorityObjectIds?: readonly string[];
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
    if (!scopedIdSet || scopedIdSet.has(objectId)) {
      ids.add(objectId);
    }
  }

  for (const objectId of input.workspaceScope?.unitObjectIds ?? []) {
    if (!scopedIdSet || scopedIdSet.has(objectId)) {
      ids.add(objectId);
    }
  }

  if (input.scopedPoints) {
    for (const point of input.scopedPoints) {
      if (ids.size >= SD_ANLEGG_POLL_TAIL_MAX_OBJECT_IDS) break;
      ids.add(point.objectId);
    }
  }

  return [...ids].slice(0, SD_ANLEGG_POLL_TAIL_MAX_OBJECT_IDS);
}
