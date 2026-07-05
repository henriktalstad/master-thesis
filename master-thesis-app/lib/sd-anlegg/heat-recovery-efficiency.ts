import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export type HeatRecoveryEfficiencySource = "source" | "derived";

export type HeatRecoveryEfficiencyResolution =
  | {
      percent: number;
      source: HeatRecoveryEfficiencySource;
      point?: InfraspawnPointListItem;
      relatedPoints: InfraspawnPointListItem[];
      category: HeatRecoveryEfficiencyCategory;
    }
  | {
      percent: null;
      source: null;
      point?: undefined;
      relatedPoints: InfraspawnPointListItem[];
      category: HeatRecoveryEfficiencyCategory;
      reason: string;
    };

export type HeatRecoveryEfficiencyCategory = "Lav" | "Normal" | "Høy" | "Av" | "Ukjent";

const SOURCE_STALE_TOLERANCE_MINUTES = 30;

function pointName(point: InfraspawnPointListItem): string {
  return (point.objectName ?? point.objectId).trim().toUpperCase();
}

function finiteValue(point: InfraspawnPointListItem | undefined): number | null {
  const value = point?.lastValue;
  return value != null && Number.isFinite(value) ? value : null;
}

function pointTimeMs(point: InfraspawnPointListItem | undefined): number | null {
  if (!point?.lastSampledAt) return null;
  const time = new Date(point.lastSampledAt).getTime();
  return Number.isFinite(time) ? time : null;
}

function findPoint(
  points: readonly InfraspawnPointListItem[],
  predicate: (name: string, point: InfraspawnPointListItem) => boolean,
): InfraspawnPointListItem | undefined {
  return points.find((point) => predicate(pointName(point), point));
}

export function findHeatRecoveryEfficiencyPoint(
  points: readonly InfraspawnPointListItem[],
): InfraspawnPointListItem | undefined {
  return findPoint(points, (name, point) => {
    const description = (point.description ?? "").toUpperCase();
    if (name === "EFFICIENCY" || name.includes("LX471_KV")) return true;
    return description.includes("VIRKNINGSGRAD") && !name.includes("LOW");
  });
}

export function findHeatRecoveryTemperaturePoints(
  points: readonly InfraspawnPointListItem[],
): {
  afterHx?: InfraspawnPointListItem;
  intake?: InfraspawnPointListItem;
  extract?: InfraspawnPointListItem;
} {
  return {
    afterHx: findPoint(points, (name) =>
      name.includes("EFFICIENCYTEMP") ||
      name.includes("RT402_MV") ||
      name === "RT402",
    ),
    intake: findPoint(points, (name) =>
      name.includes("INTAKEAIRTEMP") ||
      name.includes("RT901") ||
      name.includes("OUTDOOR"),
    ),
    extract: findPoint(points, (name) =>
      name.includes("EXTRACTAIRTEMP") ||
      name.includes("RT501"),
    ),
  };
}

export function deriveHeatRecoveryEfficiencyPercent(
  points: readonly InfraspawnPointListItem[],
): { percent: number; relatedPoints: InfraspawnPointListItem[] } | null {
  const { afterHx, intake, extract } = findHeatRecoveryTemperaturePoints(points);
  const afterHxValue = finiteValue(afterHx);
  const intakeValue = finiteValue(intake);
  const extractValue = finiteValue(extract);

  if (
    afterHxValue == null ||
    intakeValue == null ||
    extractValue == null ||
    !afterHx ||
    !intake ||
    !extract
  ) {
    return null;
  }

  const denominator = extractValue - intakeValue;
  if (Math.abs(denominator) < 0.5) return null;

  const percent = ((afterHxValue - intakeValue) / denominator) * 100;
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;

  return {
    percent,
    relatedPoints: [afterHx, intake, extract],
  };
}

function sourceIsStaleComparedToDerived(
  sourcePoint: InfraspawnPointListItem,
  derivedPoints: readonly InfraspawnPointListItem[],
): boolean {
  const sourceTime = pointTimeMs(sourcePoint);
  if (sourceTime == null) return false;

  const newestDerivedTime = derivedPoints.reduce<number | null>((newest, point) => {
    const time = pointTimeMs(point);
    if (time == null) return newest;
    return newest == null ? time : Math.max(newest, time);
  }, null);

  if (newestDerivedTime == null) return false;
  return newestDerivedTime - sourceTime > SOURCE_STALE_TOLERANCE_MINUTES * 60_000;
}

export function resolveHeatRecoveryEfficiencyCategory(input: {
  percent: number | null;
  lowEfficiencyActive?: boolean;
  hasActiveRecovery?: boolean;
}): HeatRecoveryEfficiencyCategory {
  if (input.lowEfficiencyActive) return "Lav";
  if (input.percent == null) return input.hasActiveRecovery ? "Ukjent" : "Av";
  if (input.percent < 10 && !input.hasActiveRecovery) return "Av";
  if (input.percent < 45) return "Lav";
  if (input.percent < 60) return "Normal";
  return "Høy";
}

export function resolveHeatRecoveryEfficiency(
  points: readonly InfraspawnPointListItem[],
  options: {
    lowEfficiencyActive?: boolean;
    hasActiveRecovery?: boolean;
  } = {},
): HeatRecoveryEfficiencyResolution {
  const sourcePoint = findHeatRecoveryEfficiencyPoint(points);
  const sourceValue = finiteValue(sourcePoint);
  const derived = deriveHeatRecoveryEfficiencyPercent(points);

  if (
    sourcePoint &&
    sourceValue != null &&
    sourceValue >= 0 &&
    sourceValue <= 100 &&
    (!derived || !sourceIsStaleComparedToDerived(sourcePoint, derived.relatedPoints))
  ) {
    return {
      percent: sourceValue,
      source: "source",
      point: sourcePoint,
      relatedPoints: [sourcePoint],
      category: resolveHeatRecoveryEfficiencyCategory({
        percent: sourceValue,
        lowEfficiencyActive: options.lowEfficiencyActive,
        hasActiveRecovery: options.hasActiveRecovery,
      }),
    };
  }

  if (derived) {
    return {
      percent: derived.percent,
      source: "derived",
      relatedPoints: derived.relatedPoints,
      category: resolveHeatRecoveryEfficiencyCategory({
        percent: derived.percent,
        lowEfficiencyActive: options.lowEfficiencyActive,
        hasActiveRecovery: options.hasActiveRecovery,
      }),
    };
  }

  return {
    percent: null,
    source: null,
    relatedPoints: [],
    category: resolveHeatRecoveryEfficiencyCategory({
      percent: null,
      lowEfficiencyActive: options.lowEfficiencyActive,
      hasActiveRecovery: options.hasActiveRecovery,
    }),
    reason: "Mangler gyldig Efficiency og temperaturgrunnlag",
  };
}
