import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { isInfraspawnBinarySignal } from "@/lib/infraspawn/point-status";
import { resolveAhuSignalAliasSlotIdForPoint } from "./ahu-signal-alias-registry";

export type InfraspawnValveCommandInput = Pick<
  InfraspawnPointListItem,
  "objectId" | "objectName" | "description" | "unit" | "lastValue"
>;

type ValveCommandIdentity = Pick<
  InfraspawnPointListItem,
  "objectId" | "objectName" | "description" | "unit"
>;

function normalizeName(point: ValveCommandIdentity): string {
  return (point.objectName ?? point.objectId ?? "").trim().toUpperCase();
}

/** AO_3/AO_5 fra Influx — ofte merket volts, men representerer pådrag i %. */
export function isAoValveCommandSignal(point: ValveCommandIdentity): boolean {
  const name = normalizeName(point);
  const unit = (point.unit ?? "").toLowerCase();

  if (/^AO_.*_V$/.test(name)) return false;

  if (/^AO_[35]$/.test(name)) return true;

  const slot = resolveAhuSignalAliasSlotIdForPoint(point);
  if (slot !== "heating.valve" && slot !== "heating.cool_valve") {
    return false;
  }

  if (/^SB401$|^SB501$/.test(name) && unit.includes("volt")) {
    return false;
  }

  return true;
}

/** Normaliserer pådrag til 0–100 % (0–10 V → 0–100 % når enhet er volt). */
export function resolveValveCommandPercentValue(
  point: InfraspawnValveCommandInput,
): number | null {
  const value = point.lastValue;
  if (value == null || Number.isNaN(value)) return null;

  const unit = (point.unit ?? "").toLowerCase();
  const name = normalizeName(point);

  if (unit.includes("percent")) {
    return Math.round(Math.min(100, Math.max(0, value)));
  }

  if (
    isAoValveCommandSignal(point) ||
    (name.startsWith("AO_") && !isInfraspawnBinarySignal(point))
  ) {
    if (unit.includes("volt")) {
      if (value <= 10) {
        return Math.round(Math.min(100, Math.max(0, value * 10)));
      }
      return Math.round(Math.min(100, Math.max(0, value)));
    }
    return Math.round(Math.min(100, Math.max(0, value)));
  }

  return null;
}

export function formatValveCommandPercentDisplay(
  point: InfraspawnValveCommandInput,
): string | null {
  const pct = resolveValveCommandPercentValue(point);
  if (pct == null) return null;
  return `${new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(pct)} %`;
}

export function mapValveCommandChartSampleValue(
  value: number,
  point: InfraspawnValveCommandInput,
): number | null {
  return resolveValveCommandPercentValue({ ...point, lastValue: value });
}
