import {
  formatInfraspawnPointValue,
  formatInfraspawnUnit,
} from "@/lib/infraspawn/display-format";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { AhuPresentationModel } from "./ahu-equipment-identification";
import { formatPumpCommandValue } from "./format-process-slot-display";
import {
  AHU_PUMP_PROCESS_SETTINGS_LABELS,
  AHU_PUMP_SETTINGS_SCOPE_PATTERNS,
  resolveAhuPumpProcessSettingsId,
  resolvePumpSettingsIdFromCommandPoint,
} from "./ahu-signal-alias-registry";

export type AhuProcessSettingsItem = {
  id: string;
  label: string;
  displayValue: string;
  point: InfraspawnPointListItem;
};

const EXTRACT_SETPOINT_PATTERNS = [
  "ExtractSetpoint",
  "360102_RT501_SP",
] as const;

const EXTRACT_SETPOINT_LABEL = "Settpunkt avtrekkstemp.";

const SETTINGS_ITEM_ORDER = [
  "pump.heater.command",
  "pump.cooler.command",
  "setpoint.extract",
] as const;

function normalizeToken(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function pointMatchesPattern(
  point: InfraspawnPointListItem,
  pattern: string,
): boolean {
  const token = normalizeToken(pattern);
  const name = normalizeToken(point.objectName ?? point.objectId);
  return name === token || name.includes(token);
}

function findSetpointPoint(
  points: readonly InfraspawnPointListItem[],
): InfraspawnPointListItem | undefined {
  for (const pattern of EXTRACT_SETPOINT_PATTERNS) {
    const match = points.find((point) => pointMatchesPattern(point, pattern));
    if (match) return match;
  }
  return undefined;
}

export function isAhuProcessSettingsCandidatePoint(
  point: InfraspawnPointListItem,
): boolean {
  return isAhuProcessSettingsScopePoint(point);
}

/** Signaler som skal inn i ventilasjons-workspace for Innstillinger-popover. */
export function isAhuProcessSettingsScopePoint(
  point: InfraspawnPointListItem,
): boolean {
  if (
    EXTRACT_SETPOINT_PATTERNS.some((pattern) =>
      pointMatchesPattern(point, pattern),
    )
  ) {
    return true;
  }

  return AHU_PUMP_SETTINGS_SCOPE_PATTERNS.some((pattern) =>
    pointMatchesPattern(point, pattern),
  );
}

function formatSettingsValue(point: InfraspawnPointListItem): string {
  if (point.lastValue == null || Number.isNaN(point.lastValue)) {
    return "—";
  }
  const pumpCmd = formatPumpCommandValue(point);
  if (pumpCmd) return pumpCmd;

  const formatted = formatInfraspawnPointValue(
    point.lastValue,
    point.unit,
    point,
  );
  if (formatted === "—") return formatted;

  const unit = formatInfraspawnUnit(point.unit);
  if (unit && !formatted.includes(unit)) {
    return `${formatted} ${unit}`.trim();
  }
  return formatted;
}

function resolvePumpSettingsFromModel(
  model: Pick<AhuPresentationModel, "processSlots">,
): Map<string, AhuProcessSettingsItem> {
  const items = new Map<string, AhuProcessSettingsItem>();

  for (const slot of model.processSlots) {
    if (slot.slotId !== "heating.pump") continue;

    for (const line of slot.displayLines) {
      if (line.role !== "command" || !line.point) continue;

      const settingsId =
        resolvePumpSettingsIdFromCommandPoint(line.point) ??
        resolveAhuPumpProcessSettingsId(slot.equipmentCode);
      if (!settingsId || items.has(settingsId)) continue;

      items.set(settingsId, {
        id: settingsId,
        label: AHU_PUMP_PROCESS_SETTINGS_LABELS[settingsId],
        displayValue: line.displayValue,
        point: line.point,
      });
    }
  }

  return items;
}

/** Pumper fra skjema-modell; avtrekkssetpunkt fra workspace-punkter. */
export function resolveAhuProcessSettingsItems(
  model: Pick<AhuPresentationModel, "processSlots">,
  setpointPoints: readonly InfraspawnPointListItem[],
): AhuProcessSettingsItem[] {
  const byId = resolvePumpSettingsFromModel(model);

  const setpointMatch = findSetpointPoint(setpointPoints);
  if (setpointMatch) {
    byId.set("setpoint.extract", {
      id: "setpoint.extract",
      label: EXTRACT_SETPOINT_LABEL,
      displayValue: formatSettingsValue(setpointMatch),
      point: setpointMatch,
    });
  }

  return SETTINGS_ITEM_ORDER.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}
