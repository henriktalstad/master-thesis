import { CONTROL_SIGNAL_CATALOG_360102 } from "@/lib/sd-anlegg/control/control-signal-catalog";
import {
  resolvePointForCatalogEntryInContext,
  type ControlResolveContext,
} from "@/lib/sd-anlegg/control/resolve-control-catalog";
import { resolveCoolingValveFeedbackObjectId } from "@/lib/sd-anlegg/control/resolve-cooling-valve-pct";
import type { listMpcPointMeta } from "./mpc-point-meta";
import { MPC_EVAL_DATASET_CANONICALS } from "./mpc-canonicals";

export type ResolvedEvalDatasetSignal = {
  canonicalId: string;
  objectId: string;
};

export function resolveEvalDatasetSignals(
  points: Awaited<ReturnType<typeof listMpcPointMeta>>,
  context?: ControlResolveContext,
): ResolvedEvalDatasetSignal[] {
  return MPC_EVAL_DATASET_CANONICALS.flatMap((canonicalId) => {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === canonicalId,
    );
    if (!entry) return [];
    const point = resolvePointForCatalogEntryInContext({
      points,
      entry,
      context,
    });
    if (!point) return [];
    return [{ canonicalId, objectId: point.objectId }];
  });
}

export function resolveEvalDatasetObjectIds(
  points: Awaited<ReturnType<typeof listMpcPointMeta>>,
  context?: ControlResolveContext,
): string[] {
  const objectIds = resolveEvalDatasetSignals(points, context).map(
    (row) => row.objectId,
  );
  const coolingFeedbackObjectId = resolveCoolingValveFeedbackObjectId(points);

  return [
    ...new Set([
      ...objectIds,
      ...(coolingFeedbackObjectId && !objectIds.includes(coolingFeedbackObjectId)
        ? [coolingFeedbackObjectId]
        : []),
    ]),
  ];
}
