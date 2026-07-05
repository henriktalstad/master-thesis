"use client";

import { cn } from "@/lib/utils";
import {
  resolveHeatingEquipmentDisplay,
  type HeatingProcessSlot,
} from "@/lib/sd-anlegg/heating-process-presentation";
import { resolveHeatingSlotBoundaryHint } from "@/lib/sd-anlegg/heating-slot-control-links";
import { isSdAnleggPointSelected } from "../sd-anlegg-point-key";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import { ProcessSchematicEquipmentSlot } from "./process-schematic-equipment-slot";
import { HEATING_COMBINED_LAYOUT as heatingCombinedLayoutStyles } from "./styles/heating-combined-styles";

function resolveHeatingSlotRole(slot: HeatingProcessSlot) {
  if (slot.componentType === "sensor.temperature") return "temp" as const;
  if (slot.componentType === "hvac.valve") return "valve" as const;
  if (slot.componentType === "hvac.pump") return "pump" as const;
  return "status" as const;
}

function isHeatingSensorSlot(slot: HeatingProcessSlot): boolean {
  return (
    slot.componentType === "sensor.temperature" ||
    slot.componentType === "sensor.pressure"
  );
}

export function HeatingCombinedGhostPressureSlot() {
  return (
    <ProcessSchematicEquipmentSlot
      equipmentCode="RP403"
      slotRole="status"
      componentType="sensor.pressure"
      displayLines={[{ displayValue: "—", role: "value" }]}
      subtitle="Trykk"
      missing
      layout="stack"
      className={cn("w-full", heatingCombinedLayoutStyles.ghostSensor)}
    />
  );
}

function resolveHeatingEquipmentSubtitle(
  slot: HeatingProcessSlot,
): string | undefined {
  const boundary = resolveHeatingSlotBoundaryHint(slot.slotId);
  if (slot.componentType === "hvac.pump") {
    return boundary ?? undefined;
  }
  if (slot.slotId.endsWith(".supply")) {
    return boundary ? `${boundary} · Tur` : "Tur ut";
  }
  if (slot.slotId.endsWith(".return")) {
    return boundary ? `${boundary} · Retur` : "Retur ut";
  }
  if (boundary) return boundary;
  return slot.label;
}

export function HeatingCombinedEquipmentButton({
  slot,
  selectedKeys,
  onActivate,
}: {
  slot: HeatingProcessSlot;
  selectedKeys: Set<string>;
  onActivate?: (slot: HeatingProcessSlot) => void;
}) {
  const selected = isSdAnleggPointSelected(slot.primaryPoint, selectedKeys);
  const { displayLines, stateLabel } = resolveHeatingEquipmentDisplay(slot);
  const isPump = slot.componentType === "hvac.pump";
  const isSensor = isHeatingSensorSlot(slot);
  const body = (
    <ProcessSchematicEquipmentSlot
      equipmentCode={slot.equipmentCode}
      slotRole={resolveHeatingSlotRole(slot)}
      componentType={slot.componentType}
      displayLines={displayLines}
      stateLabel={stateLabel}
      subtitle={resolveHeatingEquipmentSubtitle(slot)}
      selected={selected}
      missing={slot.confidence === "missing"}
      alarm={slot.alarm}
      layout="stack"
      className={cn(
        "w-full min-w-0",
        heatingCombinedLayoutStyles.laneEquipment,
        isPump && heatingCombinedLayoutStyles.pumpSlot,
        isSensor && heatingCombinedLayoutStyles.compactSensor,
      )}
    />
  );

  if (!slot.primaryPoint || !onActivate) {
    return body;
  }

  return (
    <button
      type="button"
      className={cn(
        heatingCombinedLayoutStyles.slotButton,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        SD_ANLEGG_BTN_PRESS,
      )}
      onClick={() => onActivate(slot)}
      aria-haspopup="dialog"
      aria-label={`Vis historikk for ${slot.equipmentCode}`}
    >
      {body}
    </button>
  );
}
