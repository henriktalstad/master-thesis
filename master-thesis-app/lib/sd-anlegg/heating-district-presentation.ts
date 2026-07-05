import { formatInfraspawnPointValue } from "@/lib/infraspawn/display-format";
import { parseInfraspawnPointIdentity } from "@/lib/infraspawn/parse-infraspawn-point-identity";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdComponentType } from "./component-types";
import { formatHeatingPointDisplayValue } from "./format-heating-display";
import {
  HEATING_DISTRICT_LANE_LABELS,
  HEATING_DISTRICT_SLOT_LAYOUT,
  resolveHeatingRegulationLabel,
  resolveHeatingSecondaryLaneLabel,
  shouldShowTapWaterLane,
  type HeatingDistrictSection,
} from "./heating-blueprint";
import { resolveHeatingExactPointLabel } from "./heating-signal-vocabulary";
import { findBestBindingRuleMatch } from "./schema-templates/match-binding-rule";
import { HEATING_DISTRICT_SECONDARY_CIRCUIT } from "./schema-templates/templates/heating.district.secondary_circuit";

export type HeatingDistrictSlot = {
  roleId: string;
  section: HeatingDistrictSection;
  equipmentCode: string;
  label: string;
  componentType: SdComponentType;
  displayValue: string | null;
  x: number;
  order: number;
  primaryPoint?: InfraspawnPointListItem;
  relatedPoints: InfraspawnPointListItem[];
  confidence: "exact" | "missing";
  alarm: boolean;
  fault: boolean;
};

export type HeatingDistrictLane = {
  id: Exclude<HeatingDistrictSection, "status">;
  label: string;
  slots: HeatingDistrictSlot[];
};

export type HeatingDistrictPresentationModel = {
  regulationLabel: string;
  outdoorTemp: HeatingDistrictSlot | null;
  lanes: HeatingDistrictLane[];
  statusSlots: HeatingDistrictSlot[];
  boundRoleCount: number;
};

function pointKey(point: InfraspawnPointListItem): string {
  return `${point.sourceId}:${point.objectId}`;
}

function resolveEquipmentCode(
  point: InfraspawnPointListItem | undefined,
  fallbackLabel: string,
): string {
  if (!point) return fallbackLabel;
  const identity = parseInfraspawnPointIdentity(point);
  if (identity?.equipmentCode) return identity.equipmentCode;
  const name = point.objectName?.trim();
  if (name) {
    const compact = name.replace(/\.\d{3}/, "").split("_")[0];
    if (compact) return compact;
  }
  return fallbackLabel;
}

function formatSlotDisplayValue(
  point: InfraspawnPointListItem | undefined,
): string | null {
  if (!point) return null;
  const heating = formatHeatingPointDisplayValue(point);
  if (heating) return heating;
  if (point.lastValue == null) return null;
  return formatInfraspawnPointValue(point.lastValue, point.unit, point);
}

function resolveSlotLabel(
  templateLabel: string,
  point: InfraspawnPointListItem | undefined,
): string {
  if (point?.objectName) {
    const exact = resolveHeatingExactPointLabel(point.objectName);
    if (exact) return exact;
  }
  return templateLabel;
}

function toSlot(
  roleId: string,
  section: HeatingDistrictSection,
  templateLabel: string,
  componentType: SdComponentType,
  point: InfraspawnPointListItem | undefined,
  layout: { x: number; order: number },
): HeatingDistrictSlot {
  const equipmentCode = resolveEquipmentCode(point, roleId);
  return {
    roleId,
    section,
    equipmentCode,
    label: resolveSlotLabel(templateLabel, point),
    componentType,
    displayValue: formatSlotDisplayValue(point),
    x: layout.x,
    order: layout.order,
    primaryPoint: point,
    relatedPoints: point ? [point] : [],
    confidence: point ? "exact" : "missing",
    alarm: Boolean(point?.statusInAlarm),
    fault: Boolean(point?.statusFault),
  };
}

export function buildHeatingDistrictPresentationModel(
  points: readonly InfraspawnPointListItem[],
  options: { elementKey?: string | null } = {},
): HeatingDistrictPresentationModel {
  const elementKey = options.elementKey ?? null;
  const usedKeys = new Set<string>();
  const slotsBySection = new Map<
    Exclude<HeatingDistrictSection, "status">,
    HeatingDistrictSlot[]
  >([
    ["primary", []],
    ["tapwater", []],
    ["secondary", []],
  ]);
  const statusSlots: HeatingDistrictSlot[] = [];
  let boundRoleCount = 0;
  let outdoorTemp: HeatingDistrictSlot | null = null;

  for (const def of HEATING_DISTRICT_SECONDARY_CIRCUIT.nodes) {
    const layout = HEATING_DISTRICT_SLOT_LAYOUT[def.id];
    if (!layout) continue;

    if (layout.section === "tapwater" && !shouldShowTapWaterLane(elementKey)) {
      continue;
    }

    const available = points.filter((point) => !usedKeys.has(pointKey(point)));
    const point = findBestBindingRuleMatch(available, def.bind, elementKey);
    if (point) {
      usedKeys.add(pointKey(point));
      boundRoleCount += 1;
    }

    const slot = toSlot(
      def.id,
      layout.section,
      def.label,
      def.componentType,
      point ?? undefined,
      layout,
    );

    if (def.id === "compensation.outdoor_temp") {
      outdoorTemp = slot;
    }

    if (layout.section === "status") {
      statusSlots.push(slot);
    } else {
      slotsBySection.get(layout.section)!.push(slot);
    }
  }

  for (const sectionSlots of slotsBySection.values()) {
    sectionSlots.sort((a, b) => a.order - b.order);
  }
  statusSlots.sort((a, b) => a.order - b.order);

  const primarySlots = slotsBySection.get("primary")!.filter(
    (slot) => slot.roleId !== "compensation.outdoor_temp",
  );
  const tapwaterSlots = slotsBySection.get("tapwater")!;
  const secondarySlots = slotsBySection.get("secondary")!;

  const lanes: HeatingDistrictLane[] = [
    {
      id: "primary",
      label: HEATING_DISTRICT_LANE_LABELS.primary,
      slots: primarySlots,
    },
  ];

  if (shouldShowTapWaterLane(elementKey) && tapwaterSlots.length > 0) {
    lanes.push({
      id: "tapwater",
      label: "Tappevann TR001",
      slots: tapwaterSlots,
    });
  }

  lanes.push({
    id: "secondary",
    label: resolveHeatingSecondaryLaneLabel(elementKey),
    slots: secondarySlots,
  });

  return {
    regulationLabel: resolveHeatingRegulationLabel(elementKey),
    outdoorTemp,
    lanes,
    statusSlots,
    boundRoleCount,
  };
}

export function heatingDistrictPresentationHasContent(
  model: HeatingDistrictPresentationModel,
): boolean {
  return model.boundRoleCount > 0;
}
