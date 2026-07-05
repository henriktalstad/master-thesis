import type {
  AhuEquipmentSlot,
  AhuPresentationModel,
  AhuStatusSlot,
} from "./ahu-equipment-identification";

function parseNumeric(value: string | null | undefined): number | null {
  if (value == null) return null;
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function fanMetrics(slot: AhuEquipmentSlot | undefined): {
  flow: number | null;
  percent: number | null;
} {
  if (!slot) return { flow: null, percent: null };

  let flow: number | null = null;
  let percent: number | null = null;

  for (const line of slot.displayLines) {
    const point = line.point;
    if (point?.lastValue != null && !Number.isNaN(point.lastValue)) {
      const name = (point.objectName ?? point.objectId).toUpperCase();
      const unit = (point.unit ?? "").toLowerCase();
      if (name.includes("FLOW") || unit.includes("cubic")) {
        flow = point.lastValue;
      }
      if (unit.includes("percent") || name.startsWith("AO_")) {
        percent = point.lastValue;
      }
    }
    if (line.displayValue.includes("m³/h")) {
      flow = parseNumeric(line.displayValue) ?? flow;
    }
    if (line.displayValue.includes("%")) {
      percent = parseNumeric(line.displayValue) ?? percent;
    }
  }

  if (flow == null && slot.displayValue?.includes("m³/h")) {
    flow = parseNumeric(slot.displayValue);
  }
  if (percent == null && slot.stateLabel?.includes("%")) {
    percent = parseNumeric(slot.stateLabel);
  }

  return { flow, percent };
}

function systemIndicatesStopped(status: AhuStatusSlot | undefined): boolean {
  const value = (status?.displayValue ?? "").trim().toLowerCase();
  if (!value || value === "—") return false;
  if (/kjører|drift|normal hastighet|på\b/.test(value)) return false;
  return /stoppet|stopp\b|\bav\b|manuell av/.test(value);
}

/** Aggregat uten målt luftstrøm — SFP=0 er da ikke informativt. */
export function isAhuAirflowInactive(
  model: Pick<AhuPresentationModel, "processSlots" | "statusSlots">,
): boolean {
  const supplyFan = model.processSlots.find((slot) => slot.slotId === "supply.fan");
  const exhaustFan = model.processSlots.find((slot) => slot.slotId === "exhaust.fan");
  const system = model.statusSlots.find((slot) => slot.slotId === "status.system");

  const supply = fanMetrics(supplyFan);
  const exhaust = fanMetrics(exhaustFan);

  const noFlow =
    (supply.flow == null || supply.flow <= 0) &&
    (exhaust.flow == null || exhaust.flow <= 0);
  const noCommand =
    (supply.percent == null || supply.percent <= 0) &&
    (exhaust.percent == null || exhaust.percent <= 0);

  if (noFlow && noCommand) return true;
  return systemIndicatesStopped(system) && noFlow;
}

export function resolveSfpStatusDisplayValue(input: {
  rawValue: number | null | undefined;
  unit?: string | null;
  airflowInactive: boolean;
}): string {
  const numeric = input.rawValue;
  const hasZeroReading = numeric == null || numeric === 0;
  const unit = (input.unit ?? "").toLowerCase();

  if (input.airflowInactive && hasZeroReading) {
    return "Stoppet";
  }

  if (numeric == null || Number.isNaN(numeric)) {
    return "—";
  }

  if (
    !unit ||
    unit === "generic" ||
    unit === "no-units" ||
    unit === "boolean"
  ) {
    return String(Math.round(numeric));
  }

  return String(numeric);
}
