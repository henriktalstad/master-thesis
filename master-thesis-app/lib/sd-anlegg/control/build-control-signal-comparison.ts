import type { ControlSdHourlyProfile } from "./control-sd-calibration";
import { sdProfileHourKey } from "./control-sd-calibration";
import { controlHourKeyFromIso } from "./control-time-buckets";
import type {
  ControlComparisonKind,
  ControlComparisonSeries,
  ControlHourlyEnergy,
  ControlLiveSignalSnapshot,
  ControlShadowAdjustments,
  ControlSignalComparison,
} from "./control-types";
import {
  applyFactorsToControlProfile,
  type ScenarioHourFactors,
} from "./scenario-hour-adjustments";

const NEUTRAL_FACTORS: ScenarioHourFactors = {
  elecFactor: 1,
  heatFactor: 1,
  controlAdjusted: false,
  supplySetpointDeltaC: 0,
  supplyFanFactor: 1,
  exhaustFanFactor: 1,
  heatingValveFactor: 1,
  coolingValveFactor: 1,
};

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function comparisonSummary(
  points: Array<{ primary: number | null; secondary: number | null }>,
): ControlComparisonSeries["summary"] {
  const errors: number[] = [];
  let hoursWithDeviation = 0;

  for (const point of points) {
    if (point.primary == null || point.secondary == null) continue;
    const err = Math.abs(point.primary - point.secondary);
    errors.push(err);
    if (err > 0.05) hoursWithDeviation += 1;
  }

  if (errors.length === 0) {
    return {
      sampleHours: 0,
      meanAbsError: null,
      maxAbsError: null,
      hoursWithDeviation: 0,
    };
  }

  return {
    sampleHours: errors.length,
    meanAbsError:
      Math.round((errors.reduce((a, b) => a + b, 0) / errors.length) * 100) / 100,
    maxAbsError: Math.round(Math.max(...errors) * 100) / 100,
    hoursWithDeviation,
  };
}

type SeriesSpec = {
  id: string;
  label: string;
  tabLabel: string;
  primaryLabel: string;
  secondaryLabel: string;
  unit: string;
  kind: ControlComparisonKind;
  pickPrimary: (profile: ControlSdHourlyProfile) => number | undefined;
  pickSecondary: (profile: ControlSdHourlyProfile) => number | undefined;
  requireDeviation?: boolean;
};

function quarterCostDeltaKr(
  energyByHour: ReadonlyMap<string, ControlHourlyEnergy>,
  stepIso: string,
  factors: ScenarioHourFactors,
): number | null {
  const row = energyByHour.get(controlHourKeyFromIso(stepIso));
  if (!row) return null;
  const baseline = row.totalCostKr / 4;
  const scoped =
    (row.electricityCostKr * factors.elecFactor +
      row.districtHeatingCostKr * factors.heatFactor) /
    4;
  return Math.round((scoped - baseline) * 100) / 100;
}

function buildHourSeries(
  spec: SeriesSpec,
  rows: readonly ControlHourlyEnergy[],
  primaryByHour: Map<string, ControlSdHourlyProfile>,
  secondaryByHour: Map<string, ControlSdHourlyProfile>,
): ControlComparisonSeries | null {
  const points = rows
    .map((row) => {
      const key = sdProfileHourKey(row.hour);
      const primaryProfile = primaryByHour.get(key);
      const secondaryProfile = secondaryByHour.get(key);
      const primary = primaryProfile ? spec.pickPrimary(primaryProfile) : undefined;
      const secondary = secondaryProfile
        ? spec.pickSecondary(secondaryProfile)
        : undefined;
      return {
        hour: row.hour,
        primary: primary != null ? round1(primary) : null,
        secondary: secondary != null ? round1(secondary) : null,
      };
    })
    .filter(
      (point): point is typeof point & { primary: number; secondary: number } =>
        point.primary != null && point.secondary != null,
    );

  const summary = comparisonSummary(points);
  if (spec.requireDeviation && summary.hoursWithDeviation === 0) return null;
  if (summary.sampleHours === 0) return null;

  return {
    id: spec.id,
    label: spec.label,
    tabLabel: spec.tabLabel,
    primaryLabel: spec.primaryLabel,
    secondaryLabel: spec.secondaryLabel,
    unit: spec.unit,
    kind: spec.kind,
    points,
    summary,
  };
}

function buildStepSeries(
  spec: SeriesSpec,
  steps: readonly ControlSdHourlyProfile[],
  primaryByStep: Map<string, ControlSdHourlyProfile>,
  secondaryByStep: Map<string, ControlSdHourlyProfile>,
  energyByHour: ReadonlyMap<string, ControlHourlyEnergy>,
  factorsByHour: ReadonlyMap<string, ScenarioHourFactors>,
  includeCost: boolean,
): ControlComparisonSeries | null {
  const points = steps
    .map((step) => {
      const stepIso = step.hour;
      const primaryProfile = primaryByStep.get(stepIso);
      const secondaryProfile = secondaryByStep.get(stepIso);
      const primary = primaryProfile ? spec.pickPrimary(primaryProfile) : undefined;
      const secondary = secondaryProfile
        ? spec.pickSecondary(secondaryProfile)
        : undefined;
      const factors =
        factorsByHour.get(controlHourKeyFromIso(stepIso)) ?? NEUTRAL_FACTORS;
      return {
        hour: stepIso,
        primary: primary != null ? round1(primary) : null,
        secondary: secondary != null ? round1(secondary) : null,
        deltaCostKr: includeCost
          ? quarterCostDeltaKr(energyByHour, stepIso, factors)
          : null,
      };
    })
    .filter(
      (point): point is typeof point & { primary: number; secondary: number } =>
        point.primary != null && point.secondary != null,
    );

  const summary = comparisonSummary(points);
  if (spec.requireDeviation && summary.hoursWithDeviation === 0) return null;
  if (summary.sampleHours === 0) return null;

  return {
    id: spec.id,
    label: spec.label,
    tabLabel: spec.tabLabel,
    primaryLabel: spec.primaryLabel,
    secondaryLabel: spec.secondaryLabel,
    unit: spec.unit,
    kind: spec.kind,
    points,
    summary,
  };
}

const SD_PAIR_SPECS: SeriesSpec[] = [
  {
    id: "supply_setpoint_vs_measured",
    label: "Tilluft settpunkt vs målt",
    tabLabel: "SP vs temp",
    primaryLabel: "Operativt settpunkt",
    secondaryLabel: "Målt tilluft",
    unit: "°C",
    kind: "setpoint_vs_measured",
    pickPrimary: (p) => p.supplySetpointC,
    pickSecondary: (p) => p.supplyTempC,
  },
  {
    id: "supply_setpoint_vs_calc",
    label: "Tilluft settpunkt vs kalkulert",
    tabLabel: "SP vs kalk.",
    primaryLabel: "Operativt settpunkt",
    secondaryLabel: "Kalkulert",
    unit: "°C",
    kind: "setpoint_vs_calc",
    pickPrimary: (p) => p.supplySetpointC,
    pickSecondary: (p) => p.supplySetpointCalcC,
  },
];

const SCOPED_SPECS: SeriesSpec[] = [
  {
    id: "supply_setpoint_scoped",
    label: "Tilluft settpunkt — SD vs shadow",
    tabLabel: "Tilluft SP",
    primaryLabel: "Målt (SD)",
    secondaryLabel: "Shadow",
    unit: "°C",
    kind: "gjeldende_vs_scoped",
    pickPrimary: (p) => p.supplySetpointC,
    pickSecondary: (p) => p.supplySetpointC,
  },
  {
    id: "supply_fan_scoped",
    label: "Tilluftvifte — SD vs shadow",
    tabLabel: "Tilluftvifte",
    primaryLabel: "Målt (SD)",
    secondaryLabel: "Shadow",
    unit: "%",
    kind: "gjeldende_vs_scoped",
    pickPrimary: (p) => p.supplyFanPct,
    pickSecondary: (p) => p.supplyFanPct,
  },
  {
    id: "exhaust_fan_scoped",
    label: "Avtrekkvifte — SD vs shadow",
    tabLabel: "Avtrekkvifte",
    primaryLabel: "Målt (SD)",
    secondaryLabel: "Shadow",
    unit: "%",
    kind: "gjeldende_vs_scoped",
    pickPrimary: (p) => p.exhaustFanPct,
    pickSecondary: (p) => p.exhaustFanPct,
  },
  {
    id: "heating_valve_scoped",
    label: "Varmebatteri — SD vs shadow",
    tabLabel: "Varmebatteri",
    primaryLabel: "Målt (SD)",
    secondaryLabel: "Shadow",
    unit: "%",
    kind: "gjeldende_vs_scoped",
    pickPrimary: (p) => p.heatingValvePct,
    pickSecondary: (p) => p.heatingValvePct,
  },
];

export type BuildScopedSignalComparisonInput = {
  hourlyEnergy: readonly ControlHourlyEnergy[];
  gjeldendeByHour: ReadonlyMap<string, ControlSdHourlyProfile>;
  scopedByHour: ReadonlyMap<string, ControlSdHourlyProfile>;
  factorsByHour: ReadonlyMap<string, ScenarioHourFactors>;
  quarterProfiles?: readonly ControlSdHourlyProfile[];
};

function sumCostDelta(
  steps: readonly ControlSdHourlyProfile[],
  energyByHour: ReadonlyMap<string, ControlHourlyEnergy>,
  factorsByHour: ReadonlyMap<string, ScenarioHourFactors>,
): number | null {
  let total = 0;
  let count = 0;
  for (const step of steps) {
    const factors =
      factorsByHour.get(controlHourKeyFromIso(step.hour)) ?? NEUTRAL_FACTORS;
    const delta = quarterCostDeltaKr(energyByHour, step.hour, factors);
    if (delta == null) continue;
    total += delta;
    count += 1;
  }
  return count > 0 ? Math.round(total * 100) / 100 : null;
}

export function toShadowAdjustments(
  factors: ScenarioHourFactors,
): ControlShadowAdjustments {
  return {
    supplySetpointDeltaC: factors.supplySetpointDeltaC,
    supplyFanFactor: factors.supplyFanFactor,
    exhaustFanFactor: factors.exhaustFanFactor,
    heatingValveFactor: factors.heatingValveFactor,
    coolingValveFactor: factors.coolingValveFactor,
  };
}

export function buildLiveSignalSnapshot(input: {
  latestStep: ControlSdHourlyProfile | null;
  factors: ScenarioHourFactors | null;
  energyByHour: ReadonlyMap<string, ControlHourlyEnergy>;
}): ControlLiveSignalSnapshot | null {
  if (!input.latestStep || !input.factors) return null;
  const shadow = applyFactorsToControlProfile(input.latestStep, input.factors);
  if (!shadow) return null;

  const pick = (p: ControlSdHourlyProfile) => ({
    supplySetpointC: p.supplySetpointC,
    supplyFanPct: p.supplyFanPct,
    exhaustFanPct: p.exhaustFanPct,
    heatingValvePct: p.heatingValvePct,
  });

  return {
    stepIso: input.latestStep.hour,
    sd: pick(input.latestStep),
    shadow: pick(shadow),
    deltaCostKrQuarter: quarterCostDeltaKr(
      input.energyByHour,
      input.latestStep.hour,
      input.factors,
    ),
  };
}

export function buildScopedSignalComparison(
  input: BuildScopedSignalComparisonInput,
): ControlSignalComparison {
  let adjustedControlHours = 0;
  for (const factors of input.factorsByHour.values()) {
    if (factors.controlAdjusted) adjustedControlHours += 1;
  }

  const energyByHour = new Map(
    input.hourlyEnergy.map((row) => [controlHourKeyFromIso(row.hour), row]),
  );

  const quarterSteps = input.quarterProfiles ?? [];
  if (quarterSteps.length > 0) {
    const observedByStep = new Map(quarterSteps.map((p) => [p.hour, p]));
    const shadowByStep = new Map<string, ControlSdHourlyProfile>();
    for (const step of quarterSteps) {
      const factors =
        input.factorsByHour.get(controlHourKeyFromIso(step.hour)) ??
        NEUTRAL_FACTORS;
      const shadow = applyFactorsToControlProfile(step, factors);
      if (shadow) shadowByStep.set(step.hour, shadow);
    }

    const series = SD_PAIR_SPECS.map((spec) =>
      buildStepSeries(
        spec,
        quarterSteps,
        observedByStep,
        observedByStep,
        energyByHour,
        input.factorsByHour,
        false,
      ),
    ).filter((s): s is ControlComparisonSeries => s != null);

    series.push(
      ...SCOPED_SPECS.map((spec) =>
        buildStepSeries(
          spec,
          quarterSteps,
          observedByStep,
          shadowByStep,
          energyByHour,
          input.factorsByHour,
          spec.kind === "gjeldende_vs_scoped",
        ),
      ).filter((s): s is ControlComparisonSeries => s != null),
    );

    const defaultSeriesId =
      series.find((s) => s.id === "supply_fan_scoped")?.id ??
      series.find((s) => s.kind === "gjeldende_vs_scoped")?.id ??
      series[0]?.id ??
      null;

    return {
      adjustedControlHours,
      series,
      defaultSeriesId,
      stepMinutes: 15,
      totalDeltaCostKr: sumCostDelta(
        quarterSteps,
        energyByHour,
        input.factorsByHour,
      ),
    };
  }

  const gjeldendeMap = new Map(input.gjeldendeByHour);
  const scopedMap = new Map(input.scopedByHour);
  const rowsWithSd = input.hourlyEnergy.filter((row) =>
    gjeldendeMap.has(sdProfileHourKey(row.hour)),
  );

  const series = SD_PAIR_SPECS.map((spec) =>
    buildHourSeries(spec, rowsWithSd, gjeldendeMap, gjeldendeMap),
  ).filter((s): s is ControlComparisonSeries => s != null);

  series.push(
    ...SCOPED_SPECS.map((spec) =>
      buildHourSeries(spec, rowsWithSd, gjeldendeMap, scopedMap),
    ).filter((s): s is ControlComparisonSeries => s != null),
  );

  const defaultSeriesId =
    series.find((s) => s.kind === "gjeldende_vs_scoped")?.id ??
    series.find((s) => s.kind === "setpoint_vs_measured")?.id ??
    series[0]?.id ??
    null;

  return {
    adjustedControlHours,
    series,
    defaultSeriesId,
    stepMinutes: 60,
    totalDeltaCostKr: null,
  };
}

/** @deprecated */
export type BuildControlSignalComparisonInput = {
  hourlyEnergy: readonly ControlHourlyEnergy[];
  sdProfiles: readonly ControlSdHourlyProfile[];
  hourlyPrices: readonly { hour: string; spotKrPerKwh: number | null }[];
  hourlyWeather: readonly { hour: string; outdoorTempC: number | null }[];
  weatherForecast?: readonly { hour: string; outdoorTempC: number | null }[];
  recommendedScenarioId: string;
  recommendedScenarioLabel: string;
  forecastHourKeys: ReadonlySet<string>;
  forecastStartIdx: number;
};

/** @deprecated Bruk buildScopedSignalComparison */
export function buildControlSignalComparison(
  input: BuildControlSignalComparisonInput,
): ControlSignalComparison {
  const gjeldendeByHour = new Map<string, ControlSdHourlyProfile>();
  for (const profile of input.sdProfiles) {
    gjeldendeByHour.set(controlHourKeyFromIso(profile.hour), profile);
  }
  return buildScopedSignalComparison({
    hourlyEnergy: input.hourlyEnergy,
    gjeldendeByHour,
    scopedByHour: gjeldendeByHour,
    factorsByHour: new Map(),
  });
}
