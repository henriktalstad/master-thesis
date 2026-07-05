"use client";

import type { AhuSlotRole } from "@/lib/sd-anlegg/ahu-blueprint";
import type { SdComponentType } from "@/lib/sd-anlegg/component-types";
import type { SlotDisplayLine } from "@/lib/sd-anlegg/format-process-slot-display";
import { ProcessSchematicEquipmentSlotView } from "./process-schematic-equipment-slot-view";

export type ProcessSchematicEquipmentSlotProps = {
  equipmentCode: string;
  slotRole: AhuSlotRole;
  componentType: SdComponentType;
  displayLines: readonly SlotDisplayLine[];
  stateLabel?: string | null;
  selected?: boolean;
  missing?: boolean;
  alarm?: boolean;
  coilVariant?: "heat" | "cool";
  layout?: "anchored" | "stack" | "hx";
  subtitle?: string;
  lane?: string;
  heatingBranchSide?: "left" | "right";
  interactive?: boolean;
  className?: string;
};

export function ProcessSchematicEquipmentSlot(
  props: ProcessSchematicEquipmentSlotProps,
) {
  return <ProcessSchematicEquipmentSlotView {...props} />;
}
