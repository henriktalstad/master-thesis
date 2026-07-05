import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { AHU_BLUEPRINT_PROCESS_SLOTS } from "./ahu-blueprint";
import type { SlotDisplayLine } from "./format-process-slot-display";
import {
  buildProcessSlotDisplayLines,
  formatPumpCommandValue,
  resolveProcessPrimaryDisplay,
} from "./format-process-slot-display";
import { isAoValveCommandSignal } from "./valve-command-percent";
import {
  resolveAhuSignalAliasSlotIdForPoint,
  isHxControlPercentSignal,
  isHxEfficiencyPercentSignal,
} from "./ahu-signal-alias-registry";
import { resolveHxLowEfficiencyAlarm } from "./ahu-schematic-alarm-indicators";
import {
  resolveHeatRecoveryEfficiency,
  type HeatRecoveryEfficiencyCategory,
} from "./heat-recovery-efficiency";
import {
  isAhuAirflowInactive,
  resolveSfpStatusDisplayValue,
} from "./ahu-airflow-inactive";
import {
  summarizeAhuIdentification,
  type AhuEquipmentSlot,
  type AhuPresentationModel,
  type AhuStatusSlot,
} from "./ahu-equipment-identification";

function numericFromFanSlot(slot: AhuEquipmentSlot | undefined): {
  flow: number | null;
  percent: number | null;
} {
  if (!slot) return { flow: null, percent: null };

  let flow: number | null = null;
  let percent: number | null = null;

  for (const line of slot.displayLines) {
    const point = line.point;
    if (!point || point.lastValue == null || Number.isNaN(point.lastValue)) {
      continue;
    }
    const name = (point.objectName ?? point.objectId).toUpperCase();
    const unit = (point.unit ?? "").toLowerCase();
    if (
      name.includes("FLOW") ||
      unit.includes("cubic") ||
      line.displayValue.includes("m³/h")
    ) {
      flow = point.lastValue;
    }
    if (
      line.label === "%" ||
      unit.includes("percent") ||
      name.startsWith("AO_")
    ) {
      percent = point.lastValue;
    }
  }

  if (flow == null && slot.primaryPoint?.lastValue != null) {
    const name = (slot.primaryPoint.objectName ?? "").toUpperCase();
    if (name.includes("FLOW")) {
      flow = slot.primaryPoint.lastValue;
    }
  }

  return { flow, percent };
}

export function inferDamperStateFromFan(input: {
  fanFlow: number | null;
  fanPercent: number | null;
}): "ÅPEN" | "LUKKET" {
  if (input.fanFlow != null && input.fanFlow > 0) return "ÅPEN";
  if (input.fanPercent != null && input.fanPercent > 0) return "ÅPEN";
  return "LUKKET";
}

function enrichDamperSlots(model: AhuPresentationModel): AhuEquipmentSlot[] {
  const supplyFan = model.processSlots.find((slot) => slot.slotId === "supply.fan");
  const exhaustFan = model.processSlots.find((slot) => slot.slotId === "exhaust.fan");
  const supplyFanMetrics = numericFromFanSlot(supplyFan);
  const exhaustFanMetrics = numericFromFanSlot(exhaustFan);

  return model.processSlots.map((slot) => {
    if (slot.role !== "damper" || slot.confidence !== "missing") {
      return slot;
    }

    const metrics =
      slot.slotId === "supply.damper" ? supplyFanMetrics : exhaustFanMetrics;
    const state = inferDamperStateFromFan({
      fanFlow: metrics.flow,
      fanPercent: metrics.percent,
    });
    const displayLines: SlotDisplayLine[] = [
      { displayValue: state, role: "status" },
    ];

    return {
      ...slot,
      confidence: "inferred" as const,
      displayValue: state,
      stateLabel: null,
      displayLines,
    };
  });
}

const HX_IDLE_LINES: SlotDisplayLine[] = [
  { label: "Hastighet", displayValue: "0 %", role: "command" },
  { label: "Effektivitet", displayValue: "Av", role: "status" },
];

function formatPercentValue(value: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(value);
}

function formatEfficiencyDisplayValue(
  percent: number | null,
  category: HeatRecoveryEfficiencyCategory,
): string {
  if (percent == null) return category;
  const categoryLabel =
    category === "Høy" || category === "Lav" || category === "Normal"
      ? category.toUpperCase()
      : category;
  return `${categoryLabel} ${formatPercentValue(percent)} %`;
}

function mergeDisplayLine(
  displayLines: readonly SlotDisplayLine[],
  line: SlotDisplayLine,
): SlotDisplayLine[] {
  const replaced = displayLines.map((entry) =>
    entry.label === line.label ? line : entry,
  );
  if (replaced.some((entry) => entry.label === line.label)) return replaced;
  return [...replaced, line];
}

function collectHxPoints(
  slot: AhuEquipmentSlot,
  points: readonly InfraspawnPointListItem[],
): InfraspawnPointListItem[] {
  const seen = new Set<string>();
  const merged: InfraspawnPointListItem[] = [];

  const add = (point: InfraspawnPointListItem) => {
    const key = `${point.sourceId}:${point.objectId}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(point);
  };

  for (const point of slot.relatedPoints) add(point);
  for (const point of points) {
    if (resolveAhuSignalAliasSlotIdForPoint(point) === "heat_recovery.unit") {
      add(point);
    }
  }

  return merged;
}

function collectAliasSlotPoints(
  slot: AhuEquipmentSlot,
  points: readonly InfraspawnPointListItem[],
  slotId: string,
): InfraspawnPointListItem[] {
  const seen = new Set<string>();
  const merged: InfraspawnPointListItem[] = [];

  const add = (point: InfraspawnPointListItem) => {
    const key = `${point.sourceId}:${point.objectId}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(point);
  };

  for (const point of slot.relatedPoints) add(point);
  for (const point of points) {
    if (resolveAhuSignalAliasSlotIdForPoint(point) === slotId) {
      add(point);
    }
  }

  return merged;
}

function enrichHeatingValveSlots(
  model: AhuPresentationModel,
  points: readonly InfraspawnPointListItem[],
): AhuEquipmentSlot[] {
  const valveSlotIds = ["heating.valve", "heating.cool_valve"] as const;

  return model.processSlots.map((slot) => {
    if (!valveSlotIds.includes(slot.slotId as (typeof valveSlotIds)[number])) {
      return slot;
    }

    const def = AHU_BLUEPRINT_PROCESS_SLOTS.find((entry) => entry.slotId === slot.slotId);
    if (!def) return slot;

    const valvePoints = collectAliasSlotPoints(slot, points, slot.slotId);
    if (valvePoints.length === 0) return slot;

    const displayPoints = valvePoints.filter((point) => {
      if (isAoValveCommandSignal(point)) return true;
      const unit = (point.unit ?? "").toLowerCase();
      return !unit.includes("volt");
    });
    if (displayPoints.length === 0) return slot;

    const displayLines = buildProcessSlotDisplayLines(def, displayPoints);
    const primaryPoint =
      displayPoints.find((point) => {
        const unit = (point.unit ?? "").toLowerCase();
        return unit.includes("percent");
      }) ??
      displayPoints.find((point) => isAoValveCommandSignal(point)) ??
      displayPoints.find((point) => {
        const name = (point.objectName ?? point.objectId).toUpperCase();
        return name.includes("SB401") || name.includes("SB501");
      }) ??
      displayPoints.find((point) => {
        const name = (point.objectName ?? point.objectId).toUpperCase();
        return name.startsWith("AO_");
      }) ??
      displayPoints[0];
    const { displayValue, stateLabel } = resolveProcessPrimaryDisplay(
      def,
      primaryPoint,
      displayLines,
    );

    return {
      ...slot,
      relatedPoints: displayPoints,
      primaryPoint: slot.primaryPoint ?? primaryPoint,
      displayLines,
      displayValue,
      stateLabel,
      confidence:
        slot.confidence === "missing" ? ("alias" as const) : slot.confidence,
      chartAffordance: true,
    };
  });
}

function enrichHeatingPumpSlot(
  model: AhuPresentationModel,
  points: readonly InfraspawnPointListItem[],
): AhuEquipmentSlot[] {
  const pumpDef = AHU_BLUEPRINT_PROCESS_SLOTS.find(
    (entry) => entry.slotId === "heating.pump",
  );
  if (!pumpDef) return model.processSlots;

  return model.processSlots.map((slot) => {
    if (slot.slotId !== "heating.pump") return slot;

    const pumpPoints = collectAliasSlotPoints(slot, points, slot.slotId);
    if (pumpPoints.length === 0) return slot;

    const runPoint = pumpPoints.find((point) =>
      /DO_SeqPumpY\d/i.test(point.objectName ?? point.objectId),
    );
    const displayPoints = pumpPoints.filter((point) => {
      const unit = (point.unit ?? "").toLowerCase();
      if (unit.includes("volt")) return false;
      if (runPoint && /DOSelect_SeqPump/i.test(point.objectName ?? point.objectId)) {
        return false;
      }
      return formatPumpCommandValue(point) != null;
    });
    const orderedPoints = runPoint
      ? [runPoint, ...displayPoints.filter((point) => point !== runPoint)]
      : displayPoints;
    if (orderedPoints.length === 0) return slot;

    const displayLines = buildProcessSlotDisplayLines(pumpDef, orderedPoints);
    const primaryPoint = runPoint ?? orderedPoints[0];
    const { displayValue, stateLabel } = resolveProcessPrimaryDisplay(
      pumpDef,
      primaryPoint,
      displayLines,
    );

    return {
      ...slot,
      relatedPoints: orderedPoints,
      primaryPoint,
      displayLines,
      displayValue,
      stateLabel,
      confidence:
        slot.confidence === "missing" ? ("alias" as const) : slot.confidence,
      chartAffordance: true,
    };
  });
}

function isSchematicVisibleProcessSlot(slot: AhuEquipmentSlot): boolean {
  if (slot.role === "pump") {
    if (slot.confidence === "missing") return false;
    const display = slot.displayValue ?? "";
    if (/volt/i.test(display)) return false;
    if (
      slot.displayLines.length === 0 &&
      (!slot.displayValue || slot.displayValue === "—")
    ) {
      return false;
    }
  }
  return true;
}

function enrichHeatRecoverySlot(
  model: AhuPresentationModel,
  points: readonly InfraspawnPointListItem[],
): AhuEquipmentSlot[] {
  const hxDef = AHU_BLUEPRINT_PROCESS_SLOTS.find(
    (slot) => slot.slotId === "heat_recovery.unit",
  );
  if (!hxDef) return model.processSlots;
  const lowEfficiencyAlarm = resolveHxLowEfficiencyAlarm(points);
  const supplyFan = model.processSlots.find((slot) => slot.slotId === "supply.fan");
  const exhaustFan = model.processSlots.find((slot) => slot.slotId === "exhaust.fan");
  const supplyFanMetrics = numericFromFanSlot(supplyFan);
  const exhaustFanMetrics = numericFromFanSlot(exhaustFan);
  const hasActiveAirflow =
    (supplyFanMetrics.flow != null && supplyFanMetrics.flow > 0) ||
    (exhaustFanMetrics.flow != null && exhaustFanMetrics.flow > 0) ||
    (supplyFanMetrics.percent != null && supplyFanMetrics.percent > 0) ||
    (exhaustFanMetrics.percent != null && exhaustFanMetrics.percent > 0);

  return model.processSlots.map((slot) => {
    if (slot.slotId !== "heat_recovery.unit") return slot;

    const hxPoints = collectHxPoints(slot, points);
    const efficiency = resolveHeatRecoveryEfficiency(points, {
      lowEfficiencyActive: lowEfficiencyAlarm.active,
      hasActiveRecovery: hasActiveAirflow,
    });
    const efficiencyLine: SlotDisplayLine | null =
      efficiency.percent != null || efficiency.category !== "Ukjent"
        ? {
            label: "Effektivitet",
            displayValue: formatEfficiencyDisplayValue(
              efficiency.percent,
              efficiency.category,
            ),
            point: efficiency.point,
            role: "status",
          }
        : null;

    if (hxPoints.length > 0 || efficiency.percent != null) {
      const relatedPoints = [...hxPoints];
      for (const point of efficiency.relatedPoints) {
        if (
          !relatedPoints.some(
            (entry) =>
              entry.sourceId === point.sourceId && entry.objectId === point.objectId,
          )
        ) {
          relatedPoints.push(point);
        }
      }
      const baseDisplayLines = buildProcessSlotDisplayLines(hxDef, hxPoints);
      const displayLines = efficiencyLine
        ? mergeDisplayLine(baseDisplayLines, efficiencyLine)
        : baseDisplayLines;
      const primaryPoint =
        hxPoints.find(isHxControlPercentSignal) ??
        efficiency.point ??
        hxPoints.find(isHxEfficiencyPercentSignal) ??
        efficiency.relatedPoints[0] ??
        hxPoints[0];
      const { displayValue, stateLabel } = resolveProcessPrimaryDisplay(
        hxDef,
        primaryPoint,
        displayLines,
      );

      return {
        ...slot,
        relatedPoints,
        primaryPoint: slot.primaryPoint ?? primaryPoint,
        displayLines,
        displayValue,
        stateLabel,
        confidence:
          slot.confidence === "missing"
            ? ("alias" as const)
            : slot.confidence,
        chartAffordance: true,
        alarm: slot.alarm || lowEfficiencyAlarm.active,
      };
    }

    return {
      ...slot,
      confidence: "inferred" as const,
      displayValue: "0 %",
      stateLabel: "Av",
      displayLines: HX_IDLE_LINES,
      chartAffordance: false,
      alarm: slot.alarm || lowEfficiencyAlarm.active,
    };
  });
}

function enrichStatusStripeSlots(model: AhuPresentationModel): AhuStatusSlot[] {
  const airflowInactive = isAhuAirflowInactive(model);

  return model.statusSlots.map((slot) => {
    if (slot.slotId !== "status.sfp" || !airflowInactive) {
      return slot;
    }

    const displayValue = resolveSfpStatusDisplayValue({
      rawValue: slot.primaryPoint?.lastValue,
      unit: slot.primaryPoint?.unit,
      airflowInactive: true,
    });

    if (displayValue === slot.displayValue) {
      return slot;
    }

    return { ...slot, displayValue };
  });
}

export function prepareAhuSchematicModel(
  model: AhuPresentationModel,
  points: readonly InfraspawnPointListItem[] = [],
): AhuPresentationModel {
  const afterDampers = enrichDamperSlots(model);
  const afterValves = enrichHeatingValveSlots(
    { ...model, processSlots: afterDampers },
    points,
  );
  const afterPump = enrichHeatingPumpSlot(
    { ...model, processSlots: afterValves },
    points,
  );
  const processSlots = enrichHeatRecoverySlot(
    { ...model, processSlots: afterPump },
    points,
  ).filter(isSchematicVisibleProcessSlot);
  const statusSlots = enrichStatusStripeSlots({ ...model, processSlots });
  return {
    ...model,
    processSlots,
    statusSlots,
    summary: summarizeAhuIdentification(processSlots, statusSlots),
  };
}
