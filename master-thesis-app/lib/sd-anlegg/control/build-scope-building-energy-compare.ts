import type { CapacityTariffAnalysis } from "./build-capacity-tariff-analysis";
import type { MpcEnergyReconcileSummary } from "./build-mpc-energy-reconcile";
import {
  hourlyPeakKwFromStepKwh,
  hourlyPeakKwFromTr003Measured,
  pickProxyElKwhEmulated,
  pickProxyHeatKwhEmulated,
} from "./hourly-peak-from-replay-steps";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

export type ScopeBuildingCarrierRow = {
  id: "el" | "heat";
  label: string;
  scopeKwh: number | null;
  buildingKwh: number | null;
  scopePeakKw: number | null;
  buildingPeakKw: number | null;
  sharePct: number | null;
};

export type ScopeBuildingEnergyCompare = {
  rows: ScopeBuildingCarrierRow[];
  evalLabel: string | null;
};

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round0(v: number): number {
  return Math.round(v);
}

function sharePct(scope: number | null, building: number | null): number | null {
  if (scope == null || building == null || building <= 0) return null;
  return round1((scope / building) * 100);
}

function sumBhcc(
  tariff: CapacityTariffAnalysis,
  pick: (row: CapacityTariffAnalysis["monthlyRows"][number]) => number | null,
): number | null {
  let total = 0;
  let any = false;
  for (const row of tariff.monthlyRows) {
    const v = pick(row);
    if (v == null) continue;
    total += v;
    any = true;
  }
  return any ? round0(total) : null;
}

function maxBhccPeak(
  tariff: CapacityTariffAnalysis,
  pick: (row: CapacityTariffAnalysis["monthlyRows"][number]) => number | null,
): number | null {
  let best: number | null = null;
  for (const row of tariff.monthlyRows) {
    const v = pick(row);
    if (v == null || v <= 0) continue;
    best = best == null ? v : Math.max(best, v);
  }
  return best != null ? round1(best) : null;
}

export function buildScopeBuildingEnergyCompare(input: {
  reconcile: MpcEnergyReconcileSummary | null;
  capacityTariff: CapacityTariffAnalysis | null;
  replaySteps?: readonly MpcReplayStep[];
}): ScopeBuildingEnergyCompare | null {
  const { reconcile, capacityTariff, replaySteps = [] } = input;
  if (!reconcile && !capacityTariff) return null;

  const scopeElKwh = reconcile?.proxy.emulated.elKwh ?? null;
  const scopeHeatKwh = reconcile?.proxy.emulated.heatKwh ?? null;
  const buildingElKwh =
    reconcile?.measured.electricityKwh ??
    (capacityTariff ? sumBhcc(capacityTariff, (r) => r.bhccElectricityKwh) : null);
  const buildingHeatKwh =
    reconcile?.circuitMeter?.tr003EnergyKwh != null &&
    reconcile.circuitMeter.tr003EnergyKwh > 0
      ? reconcile.circuitMeter.tr003EnergyKwh
      : reconcile?.measured.districtHeatingKwh ??
        (capacityTariff
          ? sumBhcc(capacityTariff, (r) => r.bhccDistrictHeatingKwh)
          : null);

  const scopeElPeak =
    replaySteps.length > 0
      ? hourlyPeakKwFromStepKwh(replaySteps, pickProxyElKwhEmulated)
      : capacityTariff?.evalPeakKw.emulated ??
        capacityTariff?.evalPeakKw.mpc ??
        null;
  const buildingElPeak = capacityTariff?.bhccEvalPeakKw ?? null;

  const buildingHeatPeak =
    (replaySteps.length > 0
      ? hourlyPeakKwFromTr003Measured(replaySteps)
      : null) ??
    capacityTariff?.bhccEvalPeakDistrictHeatingKw ??
    (capacityTariff
      ? maxBhccPeak(capacityTariff, (r) => r.bhccPeakDistrictHeatingKw)
      : null);
  const scopeHeatPeak =
    replaySteps.length > 0
      ? hourlyPeakKwFromStepKwh(replaySteps, pickProxyHeatKwhEmulated)
      : null;

  const rows: ScopeBuildingCarrierRow[] = [
    {
      id: "el",
      label: "Elektrisitet",
      scopeKwh: scopeElKwh,
      buildingKwh: buildingElKwh,
      scopePeakKw: scopeElPeak,
      buildingPeakKw: buildingElPeak,
      sharePct: sharePct(scopeElKwh, buildingElKwh),
    },
    {
      id: "heat",
      label: "Fjernvarme",
      scopeKwh: scopeHeatKwh,
      buildingKwh: buildingHeatKwh,
      scopePeakKw: scopeHeatPeak,
      buildingPeakKw: buildingHeatPeak,
      sharePct: sharePct(scopeHeatKwh, buildingHeatKwh),
    },
  ];

  const hasData = rows.some(
    (row) =>
      row.scopeKwh != null ||
      row.buildingKwh != null ||
      row.scopePeakKw != null ||
      row.buildingPeakKw != null,
  );
  if (!hasData) return null;

  const evalLabel = reconcile
    ? `${reconcile.evalStart.slice(0, 10)} – ${reconcile.evalEnd.slice(0, 10)}`
    : null;

  return { rows, evalLabel };
}
