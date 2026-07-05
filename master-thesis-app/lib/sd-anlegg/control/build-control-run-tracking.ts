import type {
  ControlHourlyEnergy,
  ControlRunTrackingPoint,
  ControlSimulationRunRecord,
} from "./control-types";

const TRACKING_WINDOW_HOURS = 24;

function energyInWindow(
  rows: readonly ControlHourlyEnergy[],
  start: Date,
  end: Date,
): { kwh: number; costKr: number; peakKw: number } {
  let kwh = 0;
  let costKr = 0;
  let peakKw = 0;
  for (const row of rows) {
    const t = new Date(row.hour).getTime();
    if (t < start.getTime() || t >= end.getTime()) continue;
    kwh += row.electricityKwh + row.districtHeatingKwh;
    costKr += row.totalCostKr;
    peakKw = Math.max(peakKw, row.electricityKwh);
  }
  return {
    kwh: Math.round(kwh),
    costKr: Math.round(costKr * 100) / 100,
    peakKw: Math.round(peakKw * 10) / 10,
  };
}

/**
 * Sammenligner lagret simuleringsprediksjon med faktisk energi etter kjøringstidspunkt.
 * Kun kjøringer eldre enn TRACKING_WINDOW_HOURS får faktisk delta.
 */
export function buildRunTrackingSeries(
  runs: readonly ControlSimulationRunRecord[],
  hourlyEnergy: readonly ControlHourlyEnergy[],
): ControlRunTrackingPoint[] {
  const now = Date.now();
  const points: ControlRunTrackingPoint[] = [];

  for (const run of runs) {
    const createdAt = new Date(run.createdAt);
    const ageHours = (now - createdAt.getTime()) / 3_600_000;
    const mpcOutlook = run.metadata?.mpcOutlook as
      | { deltaPctCostKr?: number }
      | undefined;
    const predictedDeltaPct =
      run.recommendedSummary.deltaPctCostKr ??
      mpcOutlook?.deltaPctCostKr ??
      null;

    let actualDeltaPct: number | null = null;
    let actualPeakKw: number | null = null;

    if (ageHours >= TRACKING_WINDOW_HOURS) {
      const windowEnd = new Date(createdAt.getTime() + TRACKING_WINDOW_HOURS * 3_600_000);
      const windowStart = new Date(createdAt.getTime() - TRACKING_WINDOW_HOURS * 3_600_000);
      const after = energyInWindow(hourlyEnergy, createdAt, windowEnd);
      const before = energyInWindow(hourlyEnergy, windowStart, createdAt);
      if (before.costKr > 0) {
        actualDeltaPct =
          Math.round(((after.costKr - before.costKr) / before.costKr) * 1000) / 10;
      }
      actualPeakKw = after.peakKw;
    }

    points.push({
      runId: run.id,
      createdAt: run.createdAt,
      predictedDeltaPctCostKr: predictedDeltaPct,
      actualDeltaPctCostKr: actualDeltaPct,
      actualPeakKw,
      recommendedScenarioId: run.recommendedScenarioId,
      modelVersion: run.modelVersion,
    });
  }

  return points.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function trackingAccuracySummary(
  points: readonly ControlRunTrackingPoint[],
): { comparedRuns: number; meanAbsErrorPct: number | null } {
  const withBoth = points.filter(
    (p) => p.predictedDeltaPctCostKr != null && p.actualDeltaPctCostKr != null,
  );
  if (withBoth.length === 0) {
    return { comparedRuns: 0, meanAbsErrorPct: null };
  }
  const mae =
    withBoth.reduce(
      (sum, p) =>
        sum + Math.abs(p.predictedDeltaPctCostKr! - p.actualDeltaPctCostKr!),
      0,
    ) / withBoth.length;
  return {
    comparedRuns: withBoth.length,
    meanAbsErrorPct: Math.round(mae * 10) / 10,
  };
}
