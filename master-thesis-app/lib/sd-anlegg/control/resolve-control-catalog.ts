import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { parseInfraspawnPointIdentity } from "@/lib/infraspawn/parse-infraspawn-point-identity";
import type { ControlCatalogEntry } from "./control-types";
import { CONTROL_SIGNAL_CATALOG_360102 } from "./control-signal-catalog";
import type { ControlSignalBinding } from "./control-signal-bindings";
import { findControlSignalBinding } from "./control-signal-bindings";
import { resolvePointForCatalogEntry } from "./resolve-control-signals";

export type ControlResolveContext = {
  sourceId: string;
  bindings?: readonly ControlSignalBinding[];
  unitKey?: string;
};

function normalizeUnitKey(unitKey: string | undefined): string | undefined {
  if (!unitKey?.trim()) return undefined;
  return unitKey.replace(/\./g, "");
}

export function filterPointsByUnitKey(
  points: readonly InfraspawnPointListItem[],
  unitKey: string | undefined,
): InfraspawnPointListItem[] {
  const normalized = normalizeUnitKey(unitKey);
  if (!normalized) return [...points];

  return points.filter((point) => {
    const identity = parseInfraspawnPointIdentity(point);
    if (identity?.elementKey?.replace(/\./g, "") === normalized) {
      return true;
    }
    const hay = [point.objectName, point.objectId, point.description]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(" ")
      .toUpperCase()
      .replace(/[\s.-]/g, "");
    return hay.includes(normalized);
  });
}

export function resolvePointForCatalogEntryInContext(input: {
  points: readonly InfraspawnPointListItem[];
  entry: ControlCatalogEntry;
  context?: ControlResolveContext;
}): InfraspawnPointListItem | undefined {
  const context = input.context;
  if (context?.bindings?.length) {
    const binding = findControlSignalBinding({
      bindings: context.bindings,
      sourceId: context.sourceId,
      canonicalId: input.entry.canonicalId,
      unitKey: context.unitKey,
    });
    if (binding) {
      const bound = input.points.find(
        (point) =>
          point.sourceId === binding.sourceId &&
          point.objectId === binding.objectId,
      );
      if (bound) return bound;
    }
  }

  const scoped = filterPointsByUnitKey(input.points, context?.unitKey);
  const scopedMatch = resolvePointForCatalogEntry(scoped, input.entry);
  if (scopedMatch) return scopedMatch;

  return resolvePointForCatalogEntry(input.points, input.entry);
}

export function resolveCanonicalPoint(input: {
  points: readonly InfraspawnPointListItem[];
  canonicalId: string;
  catalog?: readonly ControlCatalogEntry[];
  context?: ControlResolveContext;
}): InfraspawnPointListItem | undefined {
  const catalog = input.catalog ?? CONTROL_SIGNAL_CATALOG_360102;
  const entry = catalog.find((row) => row.canonicalId === input.canonicalId);
  if (!entry) return undefined;
  return resolvePointForCatalogEntryInContext({
    points: input.points,
    entry,
    context: input.context,
  });
}
