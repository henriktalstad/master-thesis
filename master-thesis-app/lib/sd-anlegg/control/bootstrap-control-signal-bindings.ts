import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  resolveAhuSignalAliasSlotIdForPoint,
  resolveCanonicalIdsForAliasPoint,
} from "@/lib/sd-anlegg/ahu-signal-alias-registry";
import { findPointMetadataOverride } from "@/lib/sd-anlegg/point-metadata-overrides";
import type { SdAnleggPointMetadataOverride } from "@/lib/sd-anlegg/point-metadata-overrides";
import { parseInfraspawnPointIdentity } from "@/lib/infraspawn/parse-infraspawn-point-identity";
import { CONTROL_SIGNAL_CATALOG_360102 } from "./control-signal-catalog";
import { canonicalIdsForSchemaSlot } from "./canonical-slot-map";
import type {
  ControlSignalBinding,
  ControlSignalBindingConfidence,
} from "./control-signal-bindings";
import { resolvePointForCatalogEntry } from "./resolve-control-signals";

function normalizeUnitKey(unitKey: string | undefined): string | undefined {
  if (!unitKey?.trim()) return undefined;
  return unitKey.replace(/\./g, "");
}

function inferUnitKeyFromPoint(point: InfraspawnPointListItem): string | undefined {
  const identity = parseInfraspawnPointIdentity(point);
  if (identity?.elementKey) return identity.elementKey.replace(/\./g, "");
  return undefined;
}

function bindingFromPoint(input: {
  point: InfraspawnPointListItem;
  canonicalId: string;
  unitKey?: string;
  slotId?: string;
  source: ControlSignalBinding["source"];
  confidence: ControlSignalBindingConfidence;
}): ControlSignalBinding {
  return {
    sourceId: input.point.sourceId,
    objectId: input.point.objectId,
    canonicalId: input.canonicalId,
    unitKey: input.unitKey,
    slotId: input.slotId,
    source: input.source,
    confidence: input.confidence,
  };
}

/**
 * Bygger canonical→objectId-bindinger fra site overrides, alias og katalog-mønstre.
 * Persisterte bindings (manual/override) skal merges inn via mergeControlSignalBindings.
 */
export function bootstrapControlSignalBindings(input: {
  points: readonly InfraspawnPointListItem[];
  metadataOverrides?: readonly SdAnleggPointMetadataOverride[];
  defaultUnitKey?: string;
}): ControlSignalBinding[] {
  const bindings: ControlSignalBinding[] = [];
  const seen = new Set<string>();
  const defaultUnit = normalizeUnitKey(input.defaultUnitKey);

  const add = (binding: ControlSignalBinding) => {
    const unit = binding.unitKey?.replace(/\./g, "") ?? "*";
    const key = `${binding.sourceId}:${unit}:${binding.canonicalId}:${binding.objectId}`;
    if (seen.has(key)) return;
    seen.add(key);
    bindings.push(binding);
  };

  for (const point of input.points) {
    const override = findPointMetadataOverride(
      input.metadataOverrides ?? [],
      point,
    );
    const unitKey =
      normalizeUnitKey(
        override?.scopeId?.split(":").slice(-1)[0] ?? undefined,
      ) ??
      inferUnitKeyFromPoint(point) ??
      defaultUnit;

    if (override?.schemaSlotId) {
      for (const canonicalId of canonicalIdsForSchemaSlot(override.schemaSlotId)) {
        add(
          bindingFromPoint({
            point,
            canonicalId,
            unitKey,
            slotId: override.schemaSlotId,
            source: "override",
            confidence: "high",
          }),
        );
      }
    }

    const aliasSlot = resolveAhuSignalAliasSlotIdForPoint(point);
    const aliasCanonicalIds = resolveCanonicalIdsForAliasPoint(point);
    if (aliasSlot) {
      const canonicalIds =
        aliasCanonicalIds.length > 0
          ? aliasCanonicalIds
          : canonicalIdsForSchemaSlot(aliasSlot);
      for (const canonicalId of canonicalIds) {
        add(
          bindingFromPoint({
            point,
            canonicalId,
            unitKey,
            slotId: aliasSlot,
            source: "alias",
            confidence: aliasCanonicalIds.length > 0 ? "high" : "medium",
          }),
        );
      }
    }
  }

  for (const entry of CONTROL_SIGNAL_CATALOG_360102) {
    if (entry.expectedMissing) continue;
    const point = resolvePointForCatalogEntry(input.points, entry);
    if (!point) continue;
    add(
      bindingFromPoint({
        point,
        canonicalId: entry.canonicalId,
        unitKey: inferUnitKeyFromPoint(point) ?? defaultUnit,
        source: "pattern",
        confidence: "medium",
      }),
    );
  }

  return bindings;
}
