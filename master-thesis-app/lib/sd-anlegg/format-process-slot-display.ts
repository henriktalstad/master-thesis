import {
  formatInfraspawnPointValue,
  formatInfraspawnPointValueParts,
  formatInfraspawnUnit,
  formatInfraspawnVentilationAutoModeValue,
} from "@/lib/infraspawn/display-format";
import {
  isInfraspawnBinarySignal,
  type InfraspawnBinarySignalInput,
} from "@/lib/infraspawn/point-status";
import { formatHeatingCirculationPumpMode } from "./heating-signal-vocabulary";
import {
  formatSystemairMsvValue,
  formatSystemairOperatorMsvValue,
  resolveSystemairMsvKind,
} from "./systemair-msv-labels";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { AhuBlueprintSlotDef } from "./ahu-blueprint";
import type { AhuSlotRole } from "./ahu-blueprint";
import {
  isHxControlPercentSignal,
  isHxEfficiencyPercentSignal,
} from "./ahu-signal-alias-registry";
import {
  formatSdAnleggFilterPressureValue,
  formatSdAnleggNumericValue,
  formatSdAnleggNumericWithUnit,
} from "./sd-anlegg-display-format";

import {
  formatValveCommandPercentDisplay,
  isAoValveCommandSignal,
  resolveValveCommandPercentValue,
} from "./valve-command-percent";
import { isPressureSignal } from "./ahu-signal-classifiers";

export { isHxControlPercentSignal, isHxEfficiencyPercentSignal } from "./ahu-signal-alias-registry";

export type SlotDisplayLineRole = "value" | "command" | "status" | "setpoint";

export type SlotDisplayLine = {
  label?: string;
  displayValue: string;
  point?: InfraspawnPointListItem;
  role: SlotDisplayLineRole;
};

function normalizeName(point: InfraspawnPointListItem): string {
  return (point.objectName ?? point.objectId).trim().toUpperCase();
}

function isBinaryPoint(point: InfraspawnPointListItem): boolean {
  const input: InfraspawnBinarySignalInput = {
    objectId: point.objectId,
    unit: point.unit,
    objectName: point.objectName,
    description: point.description,
  };
  return isInfraspawnBinarySignal(input);
}

function formatBinaryOnOff(point: InfraspawnPointListItem): string {
  const numeric = Number(point.lastValue);
  if (!Number.isFinite(numeric)) return "—";
  return numeric >= 1 ? "På" : "Av";
}

export function formatDamperState(point: InfraspawnPointListItem): string {
  if (!isBinaryPoint(point)) {
    return formatInfraspawnPointValue(point.lastValue, point.unit, point);
  }
  const numeric = Number(point.lastValue);
  if (!Number.isFinite(numeric)) return "—";
  return numeric >= 1 ? "ÅPEN" : "LUKKET";
}

export function formatSystemStatus(point: InfraspawnPointListItem): string {
  const numeric = Number(point.lastValue);
  if (!Number.isFinite(numeric)) return "—";

  const msv = formatSystemairOperatorMsvValue(numeric, point);
  if (msv) return msv;

  if (isBinaryPoint(point)) {
    return numeric >= 1 ? "Kjører" : "Stoppet";
  }
  return formatInfraspawnPointValue(point.lastValue, point.unit, point);
}

export function formatScheduleStatus(point: InfraspawnPointListItem): string {
  const numeric = Number(point.lastValue);
  if (!Number.isFinite(numeric)) return "—";

  const msv = formatSystemairMsvValue(numeric, point);
  if (msv) return msv;

  if (isBinaryPoint(point)) return formatBinaryOnOff(point);

  const autoMode = formatInfraspawnVentilationAutoModeValue(numeric, point);
  if (autoMode) return autoMode;
  if (numeric === 0) return "Av";
  if (numeric === 1) return "På";
  return formatInfraspawnPointValue(point.lastValue, point.unit, point);
}

export function formatPumpCommandValue(
  point: InfraspawnPointListItem,
): string | null {
  const name = normalizeName(point);
  const heatingMode = formatHeatingCirculationPumpMode(point);
  if (heatingMode) return heatingMode;

  if (/DOSELECT|SEQPUMP|_KMD/.test(name)) {
    const numeric = Number(point.lastValue);
    if (!Number.isFinite(numeric)) return "—";
    if (numeric === 0) return "Av";
    if (numeric === 1) return "På";
    if (numeric === 2 || numeric === 3) return "Auto";
    return `Modus ${numeric}`;
  }

  const msv = formatSystemairMsvValue(Number(point.lastValue), point);
  if (msv) return msv;

  if (/DO_SeqPumpY\d/.test(name) || isBinaryPoint(point)) {
    return formatInfraspawnPointValue(point.lastValue, point.unit, point);
  }

  const unit = (point.unit ?? "").toLowerCase();
  if (unit.includes("volt")) return null;

  return null;
}

export function isPumpCommandChartPoint(
  point: Pick<InfraspawnPointListItem, "objectName" | "objectId" | "description">,
): boolean {
  if (resolveSystemairMsvKind(point) === "pump_command_mode") {
    return true;
  }
  const name = (point.objectName ?? point.objectId).trim().toUpperCase();
  return /DOSELECT|SEQPUMP|_KMD/.test(name);
}

export function formatFrostGuardStatus(point: InfraspawnPointListItem): string {
  const name = normalizeName(point);
  if (name.includes("FROSTRISK")) {
    const numeric = Number(point.lastValue);
    if (!Number.isFinite(numeric)) return "—";
    return numeric >= 1 ? "Frost" : "Normal";
  }
  if (name.includes("FROSTPROTTEMP")) {
    const formatted = formatInfraspawnPointValue(
      point.lastValue,
      point.unit,
      point,
    );
    return formatted === "—" ? formatted : `Temp ${formatted}`;
  }
  if (isBinaryPoint(point)) {
    const numeric = Number(point.lastValue);
    if (!Number.isFinite(numeric)) return "—";
    return numeric >= 1 ? "Frost" : "Normal";
  }
  return formatInfraspawnPointValue(point.lastValue, point.unit, point);
}

export function formatStatusStripeValue(
  slotId: string,
  point: InfraspawnPointListItem,
): string {
  if (point.lastValue == null || Number.isNaN(point.lastValue)) return "—";

  switch (slotId) {
    case "status.system":
      return formatSystemStatus(point);
    case "status.schedule":
      return formatScheduleStatus(point);
    case "status.frost":
      return formatFrostGuardStatus(point);
    case "status.setpoint": {
      return formatSdAnleggNumericWithUnit(point.lastValue, point.unit);
    }
    case "status.sfp": {
      const formatted = formatSdAnleggNumericValue(point.lastValue, point.unit);
      const unit = point.unit?.toLowerCase() ?? "";
      if (!unit || unit === "generic" || unit === "no-units" || unit === "boolean") {
        return formatted;
      }
      const unitLabel = formatInfraspawnUnit(point.unit);
      return unitLabel ? `${formatted} ${unitLabel}` : formatted;
    }
    default:
      return formatInfraspawnPointValue(point.lastValue, point.unit, point);
  }
}

export function isFlowSignal(point: InfraspawnPointListItem): boolean {
  const name = normalizeName(point);
  const unit = (point.unit ?? "").toLowerCase();
  return (
    name.includes("FLOW") ||
    name.includes("M3") ||
    unit.includes("cubic") ||
    unit.includes("hour")
  );
}

function isEfficiencyPercentName(name: string): boolean {
  return name.includes("EFFICIENCY") && !name.includes("TEMP");
}

export function isPercentSignal(point: InfraspawnPointListItem): boolean {
  const name = normalizeName(point);
  const unit = (point.unit ?? "").toLowerCase();
  if (unit.includes("percent")) return true;
  if (isHxControlPercentSignal(point)) return true;
  if (
    unit &&
    unit !== "generic" &&
    unit !== "no-units" &&
    unit !== "boolean" &&
    !unit.includes("percent")
  ) {
    return name.includes("SPEED") || isEfficiencyPercentName(name);
  }
  if (name.startsWith("AO_")) return !isBinaryPoint(point);
  return name.includes("SPEED") || isEfficiencyPercentName(name);
}

function formatSchematicPercentValue(point: InfraspawnPointListItem): string {
  if (isBinaryPoint(point)) {
    return formatInfraspawnPointValue(point.lastValue, point.unit, point);
  }
  const pct = resolveValveCommandPercentValue(point);
  if (pct != null) {
    return formatSdAnleggNumericValue(pct, "percent");
  }
  return formatSdAnleggNumericValue(point.lastValue, "percent");
}

export function formatFilterPressure(
  point: InfraspawnPointListItem,
): string {
  return formatSdAnleggFilterPressureValue(point.lastValue);
}

function isVoltSignal(point: InfraspawnPointListItem): boolean {
  const unit = (point.unit ?? "").toLowerCase();
  return unit.includes("volt");
}

function shouldSkipProcessSchematicPoint(
  role: AhuSlotRole,
  point: InfraspawnPointListItem,
): boolean {
  if (isVoltSignal(point)) {
    if (role === "valve" || role === "coil") {
      return !isAoValveCommandSignal(point);
    }
    return role === "pump";
  }
  return false;
}

function classifyFanLineRole(point: InfraspawnPointListItem): SlotDisplayLineRole {
  if (isFlowSignal(point)) return "value";
  if (isPercentSignal(point)) return "command";
  if (isPressureSignal(point)) return "status";
  return "value";
}

function classifyHxLineRole(point: InfraspawnPointListItem): SlotDisplayLineRole {
  const name = normalizeName(point);
  if (name.includes("EFFICIENCY") && !name.includes("TEMP")) return "status";
  if (name.includes("ROTATION")) return "status";
  if (name.includes("TEMP")) return "value";
  return "value";
}

function lineLabelForPoint(
  role: AhuSlotRole,
  point: InfraspawnPointListItem,
): string | undefined {
  if (role === "fan") {
    if (isFlowSignal(point)) return undefined;
    if (isPercentSignal(point)) return undefined;
    return undefined;
  }
  if (role === "hx") {
    const name = normalizeName(point);
    const desc = (point.description ?? "").trim().toUpperCase();
    if (name.includes("LOWEFFICIENCY")) {
      return "Lav effektivitet";
    }
    if (name.includes("ROTATIONGUARD")) {
      return "Rotasjonsvakt";
    }
    if (
      desc.includes("PÅDRAG") &&
      desc.includes("GJENVINNER")
    ) {
      return "Hastighet";
    }
    if (isHxControlPercentSignal(point)) return "Hastighet";
    if (isHxEfficiencyPercentSignal(point)) return "Effektivitet";
    if (
      desc.includes("VIRKNINGSGRAD") &&
      (name.includes("LX471") || desc.includes("GJENVINNER"))
    ) {
      return "Effektivitet";
    }
    if (name.includes("LX471_KV")) return "Effektivitet";
    if (name.includes("EFFICIENCY") && !name.includes("TEMP")) return "Effektivitet";
    return undefined;
  }
  return undefined;
}

function resolveHxDisplayLine(
  point: InfraspawnPointListItem,
): SlotDisplayLine | null {
  const label = lineLabelForPoint("hx", point);
  if (!label) return null;

  const name = normalizeName(point);
  let displayValue: string;
  let lineRole: SlotDisplayLineRole;

  if (isHxControlPercentSignal(point) || (isPercentSignal(point) && !name.includes("EFFICIENCY"))) {
    displayValue = `${formatSchematicPercentValue(point)} %`;
    lineRole = "command";
  } else if (
    isBinaryPoint(point) &&
    (name.includes("LOWEFFICIENCY") ||
      name.includes("ROTATIONGUARD") ||
      (name.includes("EFFICIENCY") && !name.includes("TEMP")))
  ) {
    displayValue = formatBinaryOnOff(point);
    lineRole = "status";
  } else if (isHxEfficiencyPercentSignal(point) || isPercentSignal(point)) {
    displayValue = `${formatSchematicPercentValue(point)} %`;
    lineRole = "status";
  } else {
    displayValue = formatSdAnleggNumericWithUnit(
      point.lastValue,
      point.unit,
    );
    lineRole = classifyHxLineRole(point);
  }

  return { label, displayValue, point, role: lineRole };
}

export function buildProcessSlotDisplayLines(
  slot: AhuBlueprintSlotDef,
  relatedPoints: readonly InfraspawnPointListItem[],
): SlotDisplayLine[] {
  if (relatedPoints.length === 0) return [];

  const lines: SlotDisplayLine[] = [];

  for (const point of relatedPoints) {
    if (shouldSkipProcessSchematicPoint(slot.role, point)) continue;

    let displayValue: string;
    let lineRole: SlotDisplayLineRole = "value";

    if (slot.role === "damper") {
      displayValue = formatDamperState(point);
      lineRole = "status";
    } else if (slot.role === "filter") {
      displayValue = formatFilterPressure(point);
      lineRole = "value";
    } else if (slot.role === "fan") {
      if (isPercentSignal(point)) {
        displayValue = `${formatSchematicPercentValue(point)} %`;
        lineRole = "command";
      } else {
        displayValue = formatSdAnleggNumericWithUnit(
          point.lastValue,
          point.unit,
        );
        lineRole = classifyFanLineRole(point);
      }
    } else if (slot.role === "hx") {
      const line = resolveHxDisplayLine(point);
      if (line) lines.push(line);
      continue;
    } else if (slot.role === "pump") {
      const cmd = formatPumpCommandValue(point);
      if (!cmd) continue;
      displayValue = cmd;
      lineRole = "command";
    } else if (slot.role === "valve" || slot.role === "coil") {
      if (isAoValveCommandSignal(point)) {
        displayValue = formatValveCommandPercentDisplay(point) ?? "—";
        lineRole = "command";
      } else if (isPercentSignal(point) || normalizeName(point).startsWith("AO_")) {
        displayValue = `${formatSchematicPercentValue(point)} %`;
        lineRole = "command";
      } else {
        displayValue = formatSdAnleggNumericWithUnit(
          point.lastValue,
          point.unit,
        );
        lineRole = "value";
      }
    } else {
      displayValue = formatSdAnleggNumericWithUnit(
        point.lastValue,
        point.unit,
      );
    }

    lines.push({
      label: lineLabelForPoint(slot.role, point),
      displayValue,
      point,
      role: lineRole,
    });
  }

  return lines;
}

export function resolveProcessPrimaryDisplay(
  slot: AhuBlueprintSlotDef,
  primaryPoint: InfraspawnPointListItem | undefined,
  displayLines: readonly SlotDisplayLine[],
): { displayValue: string | null; stateLabel: string | null } {
  if (!primaryPoint && displayLines.length === 0) {
    return { displayValue: null, stateLabel: null };
  }

  if (slot.role === "damper" && primaryPoint) {
    return { displayValue: formatDamperState(primaryPoint), stateLabel: null };
  }

  if (slot.role === "fan" && displayLines.length >= 1) {
    const flowLine =
      displayLines.find((line) => line.point && isFlowSignal(line.point)) ??
      displayLines.find((line) => line.displayValue !== "—") ??
      displayLines[0];
    const pctLine = displayLines.find(
      (line) =>
        line.role === "command" ||
        line.displayValue.includes("%") ||
        (line.point && isPercentSignal(line.point)),
    );
    const pctDisplay =
      pctLine && pctLine.displayValue !== "—" ? pctLine.displayValue : null;
    return {
      displayValue: flowLine?.displayValue ?? null,
      stateLabel:
        pctDisplay && !pctDisplay.includes("%")
          ? `${pctDisplay} %`
          : pctDisplay,
    };
  }

  if (slot.role === "pump" && displayLines.length >= 1) {
    const cmdLine =
      displayLines.find((line) => line.role === "command") ?? displayLines[0];
    return { displayValue: cmdLine?.displayValue ?? null, stateLabel: null };
  }

  if (slot.role === "valve" || slot.role === "coil") {
    const pctLine =
      displayLines.find((line) => line.displayValue.includes("%")) ??
      displayLines[0];
    return { displayValue: pctLine?.displayValue ?? null, stateLabel: null };
  }

  if (slot.role === "hx" && displayLines.length >= 1) {
    const hastLine = displayLines.find((line) => line.label === "Hastighet");
    const effLine = displayLines.find((line) => line.label === "Effektivitet");
    if (hastLine || effLine) {
      return {
        displayValue:
          hastLine?.displayValue ?? effLine?.displayValue ?? null,
        stateLabel:
          hastLine && effLine ? (effLine.displayValue ?? null) : null,
      };
    }

    const tempLine = displayLines.find(
      (line) => line.point && normalizeName(line.point).includes("TEMP"),
    );
    if (tempLine) {
      const effFallback = displayLines.find((line) => line.label === "Effektivitet");
      return {
        displayValue: tempLine.displayValue,
        stateLabel: effFallback?.displayValue ?? null,
      };
    }
  }

  const primary = displayLines[0];
  if (primary) {
    return { displayValue: primary.displayValue, stateLabel: null };
  }

  if (primaryPoint) {
    return {
      displayValue: formatSdAnleggPointDisplayValue(primaryPoint, slot.role),
      stateLabel: null,
    };
  }

  return { displayValue: null, stateLabel: null };
}

export function slotHasChartAffordance(role: AhuSlotRole): boolean {
  return (
    role === "fan" ||
    role === "temp" ||
    role === "pressure" ||
    role === "filter" ||
    role === "hx" ||
    role === "coil" ||
    role === "damper"
  );
}

export function selectProcessSchematicDisplayLines(input: {
  role: AhuSlotRole;
  displayLines: readonly SlotDisplayLine[];
  displayValue: string | null;
}): SlotDisplayLine[] {
  const base =
    input.displayLines.length > 0
      ? [...input.displayLines]
      : input.displayValue && input.displayValue !== "—"
        ? [{ displayValue: input.displayValue, role: "value" as const }]
        : [];

  const withValue = base.filter((line) => line.displayValue !== "—");

  if (input.role === "fan") {
    const flow = withValue.find(
      (line) => line.point && isFlowSignal(line.point),
    );
    const pct = withValue.find(
      (line) =>
        line.role === "command" ||
        line.displayValue.includes("%") ||
        (line.point && isPercentSignal(line.point)),
    );
    const result: SlotDisplayLine[] = [];
    if (flow) result.push(flow);
    else if (withValue[0]) result.push(withValue[0]);
    if (pct && pct !== flow) result.push(pct);
    return result;
  }

  if (input.role === "filter") {
    return withValue.slice(0, 1);
  }

  if (input.role === "hx") {
    const ordered: SlotDisplayLine[] = [];
    const hast = withValue.find((line) => line.label === "Hastighet");
    const eff = withValue.find((line) => line.label === "Effektivitet");
    if (hast) ordered.push(hast);
    if (eff) ordered.push(eff);
    if (ordered.length > 0) return ordered;
    return withValue.slice(0, 2);
  }

  if (input.role === "valve") {
    const cmd = withValue.find(
      (line) =>
        line.role === "command" ||
        line.displayValue.includes("%") ||
        (line.point && isAoValveCommandSignal(line.point)),
    );
    return cmd ? [cmd] : withValue.slice(0, 1);
  }

  if (input.role === "coil" || input.role === "pump") {
    return withValue.slice(0, 1);
  }

  return withValue.slice(0, 3);
}

export function resolveProcessSchematicDisplayLines(input: {
  role: AhuSlotRole;
  displayLines: readonly SlotDisplayLine[];
  displayValue: string | null;
}): SlotDisplayLine[] {
  const lines = selectProcessSchematicDisplayLines(input);
  if (lines.length > 0) return lines;
  if (input.displayValue) {
    return [{ displayValue: input.displayValue, role: "value" }];
  }
  return [{ displayValue: "—", role: "value" }];
}

export function formatSdAnleggPointDisplayValue(
  point: InfraspawnPointListItem,
  slotRole?: AhuSlotRole | null,
): string {
  const textParts = formatInfraspawnPointValueParts(
    point.lastValue,
    point.unit,
    point,
  );
  if (textParts.kind === "empty") return "—";
  if (slotRole === "damper") return formatDamperState(point);
  if (slotRole === "filter") return formatFilterPressure(point);
  if (textParts.kind === "text") return textParts.text;
  if (slotRole === "fan") {
    if (isPercentSignal(point)) {
      return `${formatSchematicPercentValue(point)} %`;
    }
    return formatSdAnleggNumericWithUnit(point.lastValue, point.unit);
  }
  if (slotRole === "hx") {
    const hxLine = resolveHxDisplayLine(point);
    if (hxLine) return hxLine.displayValue;
  }
  if (slotRole === "valve" || slotRole === "coil") {
    if (isAoValveCommandSignal(point)) {
      return formatValveCommandPercentDisplay(point) ?? "—";
    }
    if (isPercentSignal(point)) {
      return `${formatSchematicPercentValue(point)} %`;
    }
  }
  if (slotRole === "pump") {
    const cmd = formatPumpCommandValue(point);
    if (cmd) return cmd;
  }

  if (isPercentSignal(point)) {
    return `${formatSchematicPercentValue(point)} %`;
  }

  return formatSdAnleggNumericWithUnit(point.lastValue, point.unit);
}
