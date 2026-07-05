"use client";

import { cn } from "@/lib/utils";
import type { HeatingProcessSlot } from "@/lib/sd-anlegg/heating-process-presentation";
import { resolveHeatingEquipmentDisplay } from "@/lib/sd-anlegg/heating-process-presentation";
import { isSdAnleggPointSelected } from "../sd-anlegg-point-key";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import { ProcessSchematicEquipmentSlot } from "./process-schematic-equipment-slot";
import { HEATING_COMBINED_LAYOUT as styles } from "./styles/heating-combined-styles";

type TapSlotProps = {
  slot: HeatingProcessSlot;
  selectedKeys: Set<string>;
  onActivate?: (slot: HeatingProcessSlot) => void;
  subtitle?: string;
};

function tapSubtitle(slot: HeatingProcessSlot): string {
  if (slot.componentType === "hvac.valve") return "Ventil";
  if (slot.componentType === "hvac.pump") return "Pumpe";
  if (slot.slotId.includes("supply")) return "Tur";
  return slot.label;
}

export function TapWaterFlowSlot({
  slot,
  selectedKeys,
  onActivate,
  subtitle,
}: TapSlotProps) {
  const selected = isSdAnleggPointSelected(slot.primaryPoint, selectedKeys);
  const role =
    slot.componentType === "sensor.temperature"
      ? ("temp" as const)
      : slot.componentType === "hvac.valve"
        ? ("valve" as const)
        : ("pump" as const);
  const { displayLines, stateLabel } = resolveHeatingEquipmentDisplay(slot);

  const body = (
    <ProcessSchematicEquipmentSlot
      equipmentCode={slot.equipmentCode}
      slotRole={role}
      componentType={slot.componentType}
      displayLines={displayLines}
      stateLabel={stateLabel}
      subtitle={subtitle ?? tapSubtitle(slot)}
      selected={selected}
      missing={slot.confidence === "missing"}
      alarm={slot.alarm}
      layout="stack"
      className={cn(
        "w-full min-w-0",
        styles.laneEquipment,
        role === "temp" && styles.compactSensor,
        role === "pump" && styles.pumpSlot,
      )}
    />
  );

  if (!slot.primaryPoint || !onActivate) return body;

  return (
    <button
      type="button"
      className={cn(
        styles.slotButton,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        SD_ANLEGG_BTN_PRESS,
      )}
      onClick={() => onActivate(slot)}
      aria-haspopup="dialog"
    >
      {body}
    </button>
  );
}
