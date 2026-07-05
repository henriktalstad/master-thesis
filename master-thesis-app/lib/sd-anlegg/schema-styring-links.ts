import {
  resolveAhuSlotStyringHref,
  resolveAhuSlotStyringLink,
} from "./ahu-slot-control-links";
import {
  resolveHeatingSlotStyringHref,
  resolveHeatingSlotStyringLink,
} from "./heating-slot-control-links";

export function resolveSchemaSlotStyringHref(
  buildingSlug: string,
  slotId: string,
): { href: string; label: string; tab: string } | null {
  return (
    resolveAhuSlotStyringHref(buildingSlug, slotId) ??
    resolveHeatingSlotStyringHref(buildingSlug, slotId)
  );
}

export function resolveSchemaSlotBoundaryHint(slotId: string): string | null {
  const heating = resolveHeatingSlotStyringLink(slotId);
  if (heating?.boundary === "circuit") return "Kretssnitt";
  if (heating?.boundary === "bms_local") return "Lokal SD";
  const ahu = resolveAhuSlotStyringLink(slotId);
  if (ahu) return "MPC-scope";
  if (/\.(valve|pump)/.test(slotId)) return "Lokal SD";
  return null;
}
