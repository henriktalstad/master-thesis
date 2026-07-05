import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type {
  ControlCatalogEntry,
  ControlSignalAvailability,
  ResolvedControlSignal,
} from "./control-types";
import {
  missingCriticalSignalLabelsFromSpecs,
} from "./control-signal-registry-360102";
import { CONTROL_SIGNAL_CATALOG_360102 } from "./control-signal-catalog";
import {
  resolvePointForCatalogEntryInContext,
  type ControlResolveContext,
} from "./resolve-control-catalog";
import { pointMatchesCatalogPattern } from "./signal-pattern-match";

export function resolvePointForCatalogEntry(
  points: readonly InfraspawnPointListItem[],
  entry: ControlCatalogEntry,
): InfraspawnPointListItem | undefined {
  for (const pattern of entry.influxPatterns) {
    for (const point of points) {
      if (pointMatchesCatalogPattern(point, pattern)) return point;
    }
  }
  if (entry.equipmentTagPatterns) {
    for (const pattern of entry.equipmentTagPatterns) {
      for (const point of points) {
        if (pointMatchesCatalogPattern(point, pattern)) return point;
      }
    }
  }
  return undefined;
}

export function resolveControlSignal(
  points: readonly InfraspawnPointListItem[],
  entry: ControlCatalogEntry,
): ResolvedControlSignal {
  const point = resolvePointForCatalogEntry(points, entry);
  let availability: ControlSignalAvailability = "missing";

  if (point) {
    availability = "available";
  } else if (entry.expectedMissing) {
    availability = "expected_missing";
  }

  return {
    catalog: entry,
    availability,
    point,
    lastValue: point?.lastValue ?? null,
    lastSampledAt: point?.lastSampledAt ?? null,
  };
}

export function resolveControlSignalsForCatalog(
  points: readonly InfraspawnPointListItem[],
  catalog: readonly ControlCatalogEntry[] = CONTROL_SIGNAL_CATALOG_360102,
  context?: ControlResolveContext,
): ResolvedControlSignal[] {
  if (!context) {
    return catalog.map((entry) => resolveControlSignal(points, entry));
  }

  return catalog.map((entry) => {
    const point = resolvePointForCatalogEntryInContext({
      points,
      entry,
      context,
    });
    let availability: ControlSignalAvailability = "missing";
    if (point) {
      availability = "available";
    } else if (entry.expectedMissing) {
      availability = "expected_missing";
    }

    return {
      catalog: entry,
      availability,
      point,
      lastValue: point?.lastValue ?? null,
      lastSampledAt: point?.lastSampledAt ?? null,
    };
  });
}

export function catalogCoveragePct(
  signals: readonly ResolvedControlSignal[],
): number {
  const relevant = signals.filter((s) => !s.catalog.expectedMissing);
  if (relevant.length === 0) return 0;
  const available = relevant.filter((s) => s.availability === "available").length;
  return Math.round((available / relevant.length) * 100);
}

export function missingCriticalSignalLabels(
  signals: readonly ResolvedControlSignal[],
): string[] {
  const available = new Set(
    signals
      .filter((s) => s.availability === "available")
      .map((s) => s.catalog.canonicalId),
  );
  return missingCriticalSignalLabelsFromSpecs(available);
}
