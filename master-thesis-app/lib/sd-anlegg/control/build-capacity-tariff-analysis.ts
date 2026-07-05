import { osloYearMonthFromIso } from "./control-time-buckets";
import type { ControlLoadHourPoint } from "./control-types";
import type { MonthlyBhccEnergy } from "./load-grid-tariff-monthly";
import type { MonthlyGridTariff } from "./grid-tariff-monthly";
import { resolveMonthlyGridTariff } from "./grid-tariff-monthly";

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export type MonthlyCapacityRow = {
  month: string;
  observedPeakKw: number | null;
  emulatedPeakKw: number | null;
  mpcPeakKw: number | null;
  observedPeakHour: string | null;
  emulatedPeakHour: string | null;
  mpcPeakHour: string | null;
  capacityLinkKrPerKw: number | null;
  bhccElectricityKwh: number | null;
  bhccDistrictHeatingKwh: number | null;
  bhccPeakElectricKw: number | null;
  bhccPeakDistrictHeatingKw: number | null;
  capacityCostEmulatedKr: number | null;
  capacityCostMpcKr: number | null;
  capacityCostDeltaKr: number | null;
};

export type CapacityTariffAnalysis = {
  missingTariffMonths: string[];
  tariffSyncedOnMiss: boolean;
  evalPeakKw: {
    observed: number | null;
    emulated: number | null;
    mpc: number | null;
  };
  bhccEvalPeakKw: number | null;
  bhccEvalPeakDistrictHeatingKw: number | null;
  evalPeakDeltaKw: number | null;
  evalPeakDeltaPct: number | null;
  monthlyRows: MonthlyCapacityRow[];
  estimatedCapacityCostKr: {
    emulated: number | null;
    mpc: number | null;
    deltaKr: number | null;
  };
  scopeNote: string;
};

function peakFromHourly(
  points: readonly ControlLoadHourPoint[],
  pickPeak: (p: ControlLoadHourPoint) => number | null | undefined,
): { peakKw: number; hour: string } | null {
  let best: { peakKw: number; hour: string } | null = null;
  for (const point of points) {
    const value = pickPeak(point);
    if (value == null || !Number.isFinite(value) || value <= 0) continue;
    if (!best || value > best.peakKw) {
      best = { peakKw: value, hour: point.hour };
    }
  }
  return best ? { peakKw: round1(best.peakKw), hour: best.hour } : null;
}

function monthPeakFromHourly(
  points: readonly ControlLoadHourPoint[],
  month: string,
  pickPeak: (p: ControlLoadHourPoint) => number | null | undefined,
): { peakKw: number; hour: string } | null {
  const inMonth = points.filter((p) => osloYearMonthFromIso(p.hour) === month);
  return peakFromHourly(inMonth, pickPeak);
}

export function loadProfileMissingPeakFields(
  loadProfile: readonly ControlLoadHourPoint[],
): boolean {
  return (
    loadProfile.length > 0 &&
    loadProfile.every(
      (p) =>
        p.peakEmulatedKw == null &&
        p.peakMpcKw == null &&
        p.peakObservedKw == null,
    )
  );
}
export function buildCapacityTariffAnalysis(input: {
  loadProfile: readonly ControlLoadHourPoint[];
  monthlyTariffs: ReadonlyMap<string, MonthlyGridTariff>;
  bhccByMonth?: ReadonlyMap<string, MonthlyBhccEnergy>;
  missingTariffMonths?: readonly string[];
  tariffSyncedOnMiss?: boolean;
}): CapacityTariffAnalysis | null {
  if (input.loadProfile.length === 0) return null;

  const pickObserved = (p: ControlLoadHourPoint) =>
    p.peakObservedKw ?? p.observedKw;
  const pickEmulated = (p: ControlLoadHourPoint) =>
    p.peakEmulatedKw ?? p.actualKw;
  const pickMpc = (p: ControlLoadHourPoint) => p.peakMpcKw ?? p.simulatedKw;

  const observedEval = peakFromHourly(input.loadProfile, pickObserved);
  const emulatedEval = peakFromHourly(input.loadProfile, pickEmulated);
  const mpcEval = peakFromHourly(input.loadProfile, pickMpc);

  const months = [
    ...new Set(input.loadProfile.map((p) => osloYearMonthFromIso(p.hour))),
  ].sort();

  let bhccEvalPeakKw: number | null = null;
  let bhccEvalPeakDistrictHeatingKw: number | null = null;
  for (const month of months) {
    const bhcc = input.bhccByMonth?.get(month);
    if (bhcc?.peakElectricKw != null && bhcc.peakElectricKw > 0) {
      bhccEvalPeakKw =
        bhccEvalPeakKw == null
          ? bhcc.peakElectricKw
          : Math.max(bhccEvalPeakKw, bhcc.peakElectricKw);
    }
    if (bhcc?.peakDistrictHeatingKw != null && bhcc.peakDistrictHeatingKw > 0) {
      bhccEvalPeakDistrictHeatingKw =
        bhccEvalPeakDistrictHeatingKw == null
          ? bhcc.peakDistrictHeatingKw
          : Math.max(bhccEvalPeakDistrictHeatingKw, bhcc.peakDistrictHeatingKw);
    }
  }
  if (bhccEvalPeakKw != null) bhccEvalPeakKw = round1(bhccEvalPeakKw);
  if (bhccEvalPeakDistrictHeatingKw != null) {
    bhccEvalPeakDistrictHeatingKw = round1(bhccEvalPeakDistrictHeatingKw);
  }

  const monthlyRows: MonthlyCapacityRow[] = months.map((month) => {
    const obs = monthPeakFromHourly(input.loadProfile, month, pickObserved);
    const emu = monthPeakFromHourly(input.loadProfile, month, pickEmulated);
    const mpc = monthPeakFromHourly(input.loadProfile, month, pickMpc);
    const tariff = resolveMonthlyGridTariff(month, input.monthlyTariffs);
    const link = tariff?.capacityLinkKrPerKw ?? null;
    const bhcc = input.bhccByMonth?.get(month);
    const costEmu = link != null && emu ? round2(emu.peakKw * link) : null;
    const costMpc = link != null && mpc ? round2(mpc.peakKw * link) : null;

    return {
      month,
      observedPeakKw: obs?.peakKw ?? null,
      emulatedPeakKw: emu?.peakKw ?? null,
      mpcPeakKw: mpc?.peakKw ?? null,
      observedPeakHour: obs?.hour ?? null,
      emulatedPeakHour: emu?.hour ?? null,
      mpcPeakHour: mpc?.hour ?? null,
      capacityLinkKrPerKw: link,
      bhccElectricityKwh: bhcc?.electricityKwh ?? null,
      bhccDistrictHeatingKwh: bhcc?.districtHeatingKwh ?? null,
      bhccPeakElectricKw: bhcc?.peakElectricKw ?? null,
      bhccPeakDistrictHeatingKw: bhcc?.peakDistrictHeatingKw ?? null,
      capacityCostEmulatedKr: costEmu,
      capacityCostMpcKr: costMpc,
      capacityCostDeltaKr:
        costEmu != null && costMpc != null ? round2(costEmu - costMpc) : null,
    };
  });

  const totalEmulated = monthlyRows.some((m) => m.capacityCostEmulatedKr != null)
    ? round2(
        monthlyRows.reduce((s, m) => s + (m.capacityCostEmulatedKr ?? 0), 0),
      )
    : null;
  const totalMpc = monthlyRows.some((m) => m.capacityCostMpcKr != null)
    ? round2(monthlyRows.reduce((s, m) => s + (m.capacityCostMpcKr ?? 0), 0))
    : null;

  const evalDeltaKw =
    emulatedEval && mpcEval
      ? round1(mpcEval.peakKw - emulatedEval.peakKw)
      : null;

  return {
    missingTariffMonths: [...(input.missingTariffMonths ?? [])],
    tariffSyncedOnMiss: input.tariffSyncedOnMiss ?? false,
    evalPeakKw: {
      observed: observedEval?.peakKw ?? null,
      emulated: emulatedEval?.peakKw ?? null,
      mpc: mpcEval?.peakKw ?? null,
    },
    bhccEvalPeakKw,
    bhccEvalPeakDistrictHeatingKw,
    evalPeakDeltaKw: evalDeltaKw,
    evalPeakDeltaPct:
      emulatedEval && mpcEval && emulatedEval.peakKw > 0
        ? round1((evalDeltaKw! / emulatedEval.peakKw) * 100)
        : null,
    monthlyRows,
    estimatedCapacityCostKr: {
      emulated: totalEmulated,
      mpc: totalMpc,
      deltaKr:
        totalEmulated != null && totalMpc != null
          ? round2(totalEmulated - totalMpc)
          : null,
    },
    scopeNote:
      "Månedlig effekttopp for ventilasjon × nettleie effektledd.",
  };
}
