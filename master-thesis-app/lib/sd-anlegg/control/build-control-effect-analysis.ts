import type { ControlSdHourlyProfile } from "./control-sd-calibration";
import { sdProfileByHour, sdProfileHourKey } from "./control-sd-calibration";
import { controlHourKeyFromIso } from "./control-time-buckets";
import type {
  ControlHourlyEnergy,
  ControlHourlyPrice,
  ControlLoadHourPoint,
  ControlPeakAnalysis,
  ControlSignalImpact,
} from "./control-types";

/** Timevis last (kWh/h ≈ kW snitt). */
export function buildHourlyLoadProfile(
  rows: readonly ControlHourlyEnergy[],
  prices: readonly ControlHourlyPrice[],
  simulatedKwByHour?: ReadonlyMap<string, number>,
): ControlLoadHourPoint[] {
  const priceByHour = new Map(
    prices.map((p) => [controlHourKeyFromIso(p.hour), p.spotKrPerKwh]),
  );

  return rows.map((row) => {
    const key = controlHourKeyFromIso(row.hour);
    return {
      hour: row.hour,
      actualKw: Math.round(row.electricityKwh * 10) / 10,
      simulatedKw: simulatedKwByHour?.get(key),
      costKr: Math.round(row.totalCostKr * 100) / 100,
      spotKrPerKwh: priceByHour.get(key) ?? null,
    };
  });
}

export function computePeakFromLoad(
  points: readonly ControlLoadHourPoint[],
  field: "actualKw" | "simulatedKw" = "actualKw",
): { peakKw: number; hour: string } {
  let peakKw = 0;
  let hour = points[0]?.hour ?? "";
  for (const point of points) {
    const value = field === "actualKw" ? point.actualKw : point.simulatedKw;
    if (value == null || value <= peakKw) continue;
    peakKw = value;
    hour = point.hour;
  }
  return { peakKw: Math.round(peakKw * 10) / 10, hour };
}

export function buildPeakAnalysis(
  loadProfile: readonly ControlLoadHourPoint[],
): ControlPeakAnalysis {
  const actual = computePeakFromLoad(loadProfile, "actualKw");
  const simulated = computePeakFromLoad(loadProfile, "simulatedKw");
  const hasSim = simulated.peakKw > 0;
  const deltaKw = hasSim ? simulated.peakKw - actual.peakKw : 0;
  const deltaPct =
    actual.peakKw > 0 && hasSim
      ? Math.round((deltaKw / actual.peakKw) * 1000) / 10
      : 0;

  return {
    actualPeakKw: actual.peakKw,
    actualPeakHour: actual.hour,
    simulatedPeakKw: hasSim ? simulated.peakKw : null,
    peakDeltaKw: hasSim ? Math.round(deltaKw * 10) / 10 : null,
    peakDeltaPct: hasSim ? deltaPct : null,
  };
}

function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length < 8 || xs.length !== ys.length) return null;
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return null;
  return Math.round((num / Math.sqrt(denX * denY)) * 100) / 100;
}

const SIGNAL_FACTORS: Array<{
  key: keyof Omit<ControlSdHourlyProfile, "hour">;
  label: string;
  unit: string;
}> = [
  { key: "supplyFanPct", label: "Tilluftvifte", unit: "%" },
  { key: "exhaustFanPct", label: "Avtrekkvifte", unit: "%" },
  { key: "heatingValvePct", label: "Varmebatteri", unit: "%" },
  { key: "coolingValvePct", label: "Kjølebatteri", unit: "%" },
  { key: "supplySetpointC", label: "Tilluft settpunkt", unit: "°C" },
];

/** Korrelasjon mellom SD-pådrag og timevis el-forbruk (kW). */
export function buildSignalImpactAnalysis(
  hourlyEnergy: readonly ControlHourlyEnergy[],
  sdProfiles: readonly ControlSdHourlyProfile[],
): ControlSignalImpact[] {
  const sdByHour = sdProfileByHour(sdProfiles);
  const impacts: ControlSignalImpact[] = [];

  for (const factor of SIGNAL_FACTORS) {
    const xs: number[] = [];
    const ys: number[] = [];
    const costs: number[] = [];

    for (const row of hourlyEnergy) {
      const profile = sdByHour.get(sdProfileHourKey(row.hour));
      if (!profile) continue;
      const x = profile[factor.key];
      if (x == null) continue;
      xs.push(x);
      ys.push(row.electricityKwh);
      costs.push(row.electricityCostKr);
    }

    const corrKwh = pearson(xs, ys);
    const corrCost = pearson(xs, costs);
    if (corrKwh == null && corrCost == null) continue;

    impacts.push({
      signalKey: factor.key,
      label: factor.label,
      unit: factor.unit,
      sampleHours: xs.length,
      correlationKwh: corrKwh,
      correlationCostKr: corrCost,
    });
  }

  return impacts.sort(
    (a, b) =>
      Math.abs(b.correlationKwh ?? 0) - Math.abs(a.correlationKwh ?? 0),
  );
}

export function aggregateDailyLoad(
  loadProfile: readonly ControlLoadHourPoint[],
): Array<{
  day: string;
  totalKwh: number;
  totalCostKr: number;
  peakKw: number;
}> {
  const byDay = new Map<
    string,
    { kwh: number; cost: number; peak: number }
  >();

  for (const point of loadProfile) {
    const day = point.hour.slice(0, 10);
    const agg = byDay.get(day) ?? { kwh: 0, cost: 0, peak: 0 };
    if (point.actualKw != null) {
      agg.kwh += point.actualKw;
      agg.peak = Math.max(agg.peak, point.actualKw);
    }
    agg.cost += point.costKr;
    byDay.set(day, agg);
  }

  return [...byDay.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([day, agg]) => ({
      day,
      totalKwh: Math.round(agg.kwh),
      totalCostKr: Math.round(agg.cost),
      peakKw: Math.round(agg.peak * 10) / 10,
    }));
}
