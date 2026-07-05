import { minutesSinceIso } from "@/lib/infraspawn/display-format";
import { resolveInfraspawnPointDisplayStatus } from "@/lib/infraspawn/point-status";
import type {
  InfraspawnBuildingHealthSummary,
  InfraspawnPointListItem,
} from "@/lib/infraspawn/types";

export type MeasurementPoint = { lastSampledAt: string | null };

/** Nyeste måletid blant et utvalg punkter. */
export function newestMeasurementAt(
  points: readonly MeasurementPoint[],
): string | null {
  let latestMs = 0;
  let latestIso: string | null = null;
  for (const point of points) {
    const sampledAt = point.lastSampledAt;
    if (!sampledAt) continue;
    const ms = new Date(sampledAt).getTime();
    if (!Number.isNaN(ms) && ms > latestMs) {
      latestMs = ms;
      latestIso = sampledAt;
    }
  }
  return latestIso;
}

/** Oppdater health-stripe med live punkter fra on-demand poll. */
export function mergeLiveHealthSummary(
  base: InfraspawnBuildingHealthSummary,
  points: readonly InfraspawnPointListItem[] | undefined,
): InfraspawnBuildingHealthSummary {
  if (!points?.length) return base;

  let alarmPointCount = 0;
  let faultPointCount = 0;
  let outOfServicePointCount = 0;
  let unhealthyPointCount = 0;
  let noValuePointCount = 0;

  for (const point of points) {
    const status = resolveInfraspawnPointDisplayStatus(point);
    if (status === "alarm") alarmPointCount += 1;
    if (status === "fault") faultPointCount += 1;
    if (status === "out_of_service") outOfServicePointCount += 1;
    if (status != null) unhealthyPointCount += 1;
    if (point.lastValue == null || Number.isNaN(point.lastValue)) {
      noValuePointCount += 1;
    }
  }

  const newestSampleAt = newestMeasurementAt(points);
  const newestSampleAgeMinutes = minutesSinceIso(newestSampleAt);

  return {
    ...base,
    pointCount: points.length,
    alarmPointCount,
    faultPointCount,
    outOfServicePointCount,
    unhealthyPointCount,
    noValuePointCount,
    newestSampleAt,
    newestSampleAgeMinutes,
  };
}
