import { resolveAhuSlotStyringLink } from "@/lib/sd-anlegg/ahu-slot-control-links";

/** Bro mellom skjema-slotId og MPC/styring canonicalId. */
export type CanonicalSlotMapping = {
  slotId: string;
  canonicalId: string;
};

const EXTRA_SLOT_CANONICAL_MAPPINGS: readonly CanonicalSlotMapping[] = [
  { slotId: "supply.temp_mid", canonicalId: "heat_recovery.after_temp" },
  { slotId: "heat_recovery.unit", canonicalId: "heat_recovery.command" },
  { slotId: "status.frost", canonicalId: "constraint.frost" },
  { slotId: "status.schedule", canonicalId: "system.schedule" },
  { slotId: "heating.temp", canonicalId: "heating.coil_temp" },
  { slotId: "status.setpoint", canonicalId: "supply.setpoint" },
  { slotId: "status.setpoint", canonicalId: "supply.setpoint_calculated" },
];

const AHU_SLOT_IDS = [
  "supply.fan",
  "exhaust.fan",
  "heating.valve",
  "heating.cool_valve",
  "supply.temp_out",
  "exhaust.temp",
  "supply.temp_in",
  "status.setpoint",
  "status.system",
] as const;

function buildSlotCanonicalMap(): Map<string, string[]> {
  const map = new Map<string, string[]>();

  const add = (slotId: string, canonicalId: string) => {
    const list = map.get(slotId) ?? [];
    if (!list.includes(canonicalId)) list.push(canonicalId);
    map.set(slotId, list);
  };

  for (const slotId of AHU_SLOT_IDS) {
    const link = resolveAhuSlotStyringLink(slotId);
    if (link) add(slotId, link.canonicalId);
  }

  for (const row of EXTRA_SLOT_CANONICAL_MAPPINGS) {
    add(row.slotId, row.canonicalId);
  }

  return map;
}

const SLOT_TO_CANONICAL = buildSlotCanonicalMap();

export function canonicalIdsForSchemaSlot(slotId: string): readonly string[] {
  return SLOT_TO_CANONICAL.get(slotId) ?? [];
}

export function primaryCanonicalForSchemaSlot(slotId: string): string | null {
  return canonicalIdsForSchemaSlot(slotId)[0] ?? null;
}

export function schemaSlotForCanonicalId(canonicalId: string): string | null {
  for (const [slotId, canonicalIds] of SLOT_TO_CANONICAL.entries()) {
    if (canonicalIds.includes(canonicalId)) return slotId;
  }
  return null;
}
