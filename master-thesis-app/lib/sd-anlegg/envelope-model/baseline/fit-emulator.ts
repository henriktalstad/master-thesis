import { median } from "@/lib/sd-anlegg/envelope-model/lib/stats";
import { mergeControlVector, controlVector } from "@/lib/sd-anlegg/mpc/controller/optimizer/control-vector";
import { fitLinearRegression } from "@/lib/sd-anlegg/envelope-model/lib/linear-regression";
import { isNormalDriftTrainingStep } from "@/lib/sd-anlegg/mpc/config/constraints/normal-drift-step";
import { mpcTemplateKey, mpcHourlyTemplateKey } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import type {
  BaselineEmulatorParams,
  EmulateBaselineOptions,
  MpcControlVector,
  MpcTimestep,
} from "@/lib/sd-anlegg/mpc/shared/types";
import { MPC_CONTROL_KEYS } from "@/lib/sd-anlegg/mpc/shared/types";

const DEFAULT_EMULATOR_FALLBACK = controlVector({
  supplySetpointC: 18,
  supplyFanPct: 30,
  exhaustFanPct: 30,
});

const COMFORT_AWARE_SIGNALS = [
  "heatingValvePct",
  "supplySetpointC",
  "coolingValvePct",
] as const satisfies readonly (keyof MpcControlVector)[];

const DEFAULT_EXTRACT_SETPOINT_C = 21;
const FAN_ON_THRESHOLD_PCT = 5;
const COIL_ACTIVE_THRESHOLD_PCT = 8;

function round1Decimal(v: number): number {
  return Math.round(v * 10) / 10;
}

function templateKeyFromTimestep(step: MpcTimestep): string {
  return mpcTemplateKey(step.dowUtc, step.hourUtc, step.quarterUtc);
}

function buildTemplateControl(
  params: BaselineEmulatorParams,
  step: MpcTimestep,
  baseFallback: MpcControlVector,
): MpcControlVector {
  const key = templateKeyFromTimestep(step);
  const template = params.templates[key] ?? {};
  const hourlyKey = mpcHourlyTemplateKey(step.hourUtc, step.quarterUtc);
  const hourlyTemplate = params.hourlyTemplates?.[hourlyKey] ?? {};
  const hourlyFallback = mergeControlVector(hourlyTemplate, baseFallback);
  const u = mergeControlVector(template, hourlyFallback);

  if (step.outdoorTempC != null) {
    for (const signal of MPC_CONTROL_KEYS) {
      const slope = params.weatherSlopes[signal];
      if (slope != null) u[signal] += slope * step.outdoorTempC;
    }
  }

  if (
    step.supplySetpointCalcC != null &&
    Number.isFinite(step.supplySetpointCalcC)
  ) {
    const delta = step.supplySetpointCalcC - u.supplySetpointC;
    if (Math.abs(delta) > 0.05) {
      u.supplySetpointC += delta * 0.35;
    }
  }

  return u;
}

export function fitBaselineEmulator(
  train: readonly MpcTimestep[],
): BaselineEmulatorParams {
  const normalSteps = train.filter(isNormalDriftTrainingStep);
  const fitSteps = normalSteps.length >= 48 ? normalSteps : train.filter((s) => s.uMeas);

  const byTemplate = new Map<string, MpcTimestep[]>();
  const byHourly = new Map<string, MpcTimestep[]>();
  const globalSteps: MpcTimestep[] = [];

  for (const step of fitSteps) {
    if (!step.uMeas) continue;
    const key = templateKeyFromTimestep(step);
    const bucket = byTemplate.get(key) ?? [];
    bucket.push(step);
    byTemplate.set(key, bucket);

    const hourlyKey = mpcHourlyTemplateKey(step.hourUtc, step.quarterUtc);
    const hourlyBucket = byHourly.get(hourlyKey) ?? [];
    hourlyBucket.push(step);
    byHourly.set(hourlyKey, hourlyBucket);

    globalSteps.push(step);
  }

  const templates: BaselineEmulatorParams["templates"] = {};
  for (const [key, steps] of byTemplate) {
    const partial: Partial<MpcControlVector> = {};
    for (const signal of MPC_CONTROL_KEYS) {
      const value = medianControlSignal(steps, signal);
      if (value != null) partial[signal] = value;
    }
    templates[key] = partial;
  }

  const hourlyTemplates: NonNullable<BaselineEmulatorParams["hourlyTemplates"]> = {};
  for (const [key, steps] of byHourly) {
    const partial: Partial<MpcControlVector> = {};
    for (const signal of MPC_CONTROL_KEYS) {
      const value = medianControlSignal(steps, signal);
      if (value != null) partial[signal] = value;
    }
    hourlyTemplates[key] = partial;
  }

  const globalMedians: Partial<MpcControlVector> = {};
  for (const signal of MPC_CONTROL_KEYS) {
    const value = medianControlSignal(globalSteps, signal);
    if (value != null) globalMedians[signal] = value;
  }

  const defaultVector: MpcControlVector = {
    supplySetpointC: 18,
    supplyFanPct: 30,
    exhaustFanPct: 30,
    heatingValvePct: 0,
    coolingValvePct: 0,
    districtTr002ValvePct: 0,
    districtTr003ValvePct: 0,
  };

  const finalizedGlobalMedians = finalizeEmulatorGlobalMedians(
    globalMedians,
    fitSteps,
    defaultVector,
  );

  const weatherSlopes: BaselineEmulatorParams["weatherSlopes"] = {};
  for (const signal of MPC_CONTROL_KEYS) {
    const rows: { x: number[]; y: number }[] = [];
    for (const step of fitSteps) {
      if (!step.uMeas || step.outdoorTempC == null) continue;
      if (!signalActiveOnStep(step, signal)) continue;
      const template = templates[templateKeyFromTimestep(step)];
      const hourlyKey = mpcHourlyTemplateKey(step.hourUtc, step.quarterUtc);
      const base =
        template?.[signal] ??
        hourlyTemplates[hourlyKey]?.[signal] ??
        finalizedGlobalMedians[signal];
      if (base == null) continue;
      rows.push({
        x: [step.outdoorTempC],
        y: step.uMeas[signal] - base,
      });
    }
    const model = fitLinearRegression(rows, 1e-4);
    if (model?.coefficients[0] != null) {
      weatherSlopes[signal] = Math.round(model.coefficients[0] * 1000) / 1000;
    }
  }

  const setpointValues = fitSteps
    .map((step) => step.extractSetpointC)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const defaultExtractSetpointC =
    setpointValues.length > 0
      ? Math.round(median(setpointValues) * 10) / 10
      : DEFAULT_EXTRACT_SETPOINT_C;

  const baseParams: BaselineEmulatorParams = {
    version: "bms-emulator-v1.3-hourly-fallback",
    templates,
    hourlyTemplates,
    weatherSlopes,
    globalMedians: finalizedGlobalMedians,
    defaultExtractSetpointC,
    trainNormalStepCount: fitSteps.length,
  };

  return {
    ...baseParams,
    comfortErrorSlopes: fitComfortErrorSlopes(
      fitSteps,
      baseParams,
      defaultExtractSetpointC,
    ),
  };
}

function fitComfortErrorSlopes(
  fitSteps: readonly MpcTimestep[],
  params: BaselineEmulatorParams,
  defaultExtractSetpointC: number,
): BaselineEmulatorParams["comfortErrorSlopes"] {
  const baseFallback = mergeControlVector(
    params.globalMedians,
    DEFAULT_EMULATOR_FALLBACK,
  );
  const slopes: NonNullable<BaselineEmulatorParams["comfortErrorSlopes"]> = {};

  for (const signal of COMFORT_AWARE_SIGNALS) {
    const rows: { x: number[]; y: number }[] = [];
    for (let i = 1; i < fitSteps.length; i++) {
      const step = fitSteps[i]!;
      const prev = fitSteps[i - 1]!;
      if (!step.uMeas || prev.extractTempC == null) continue;
      if (!signalActiveOnStep(step, signal)) continue;

      const uTemplate = buildTemplateControl(params, step, baseFallback);
      const setpoint = step.extractSetpointC ?? defaultExtractSetpointC;
      const comfortError = setpoint - prev.extractTempC;
      rows.push({
        x: [comfortError],
        y: step.uMeas[signal] - uTemplate[signal],
      });
    }
    const model = fitLinearRegression(rows, 1e-4);
    if (model?.coefficients[0] != null) {
      slopes[signal] = Math.round(model.coefficients[0] * 100) / 100;
    }
  }

  return slopes;
}

function coolingActiveOnStep(step: MpcTimestep): boolean {
  return (
    step.coolingActive ||
    (step.uMeas?.coolingValvePct ?? 0) > COIL_ACTIVE_THRESHOLD_PCT
  );
}

function signalActiveOnStep(
  step: MpcTimestep,
  signal: keyof MpcControlVector,
): boolean {
  if (signal === "coolingValvePct") return coolingActiveOnStep(step);
  return step.uMeas != null;
}

function medianControlSignal(
  steps: readonly MpcTimestep[],
  signal: keyof MpcControlVector,
): number | undefined {
  const values = steps
    .filter((step) => signalActiveOnStep(step, signal))
    .map((step) => step.uMeas?.[signal])
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (!values.length) {
    if (signal === "coolingValvePct") return 0;
    return undefined;
  }
  return median(values);
}

function applyBmsModeGating(u: MpcControlVector, step: MpcTimestep): MpcControlVector {
  if (step.coolingActive) return u;
  return { ...u, coolingValvePct: 0 };
}

function medianActiveSignal(
  train: readonly MpcTimestep[],
  signal: "supplyFanPct" | "exhaustFanPct",
  threshold: number,
): number | undefined {
  const values = train
    .map((step) => step.uMeas?.[signal])
    .filter((v): v is number => v != null && Number.isFinite(v) && v > threshold);
  return values.length ? median(values) : undefined;
}

function finalizeEmulatorGlobalMedians(
  medians: Partial<MpcControlVector>,
  train: readonly MpcTimestep[],
  defaults: MpcControlVector,
): MpcControlVector {
  const out = mergeControlVector(medians, defaults);
  const anySupplyFanOn = train.some(
    (step) => (step.uMeas?.supplyFanPct ?? 0) > FAN_ON_THRESHOLD_PCT,
  );
  const anyExhaustFanOn = train.some(
    (step) => (step.uMeas?.exhaustFanPct ?? 0) > FAN_ON_THRESHOLD_PCT,
  );
  if (anySupplyFanOn && (medians.supplyFanPct ?? 0) < FAN_ON_THRESHOLD_PCT) {
    out.supplyFanPct =
      medianActiveSignal(train, "supplyFanPct", FAN_ON_THRESHOLD_PCT) ?? defaults.supplyFanPct;
  }
  if (anyExhaustFanOn && (medians.exhaustFanPct ?? 0) < FAN_ON_THRESHOLD_PCT) {
    out.exhaustFanPct =
      medianActiveSignal(train, "exhaustFanPct", FAN_ON_THRESHOLD_PCT) ?? defaults.exhaustFanPct;
  }
  return out;
}

function applyComfortErrorCorrection(
  u: MpcControlVector,
  params: BaselineEmulatorParams,
  step: MpcTimestep,
  tExtPrev: number | null | undefined,
): void {
  const slopes = params.comfortErrorSlopes;
  if (!slopes || tExtPrev == null || !Number.isFinite(tExtPrev)) return;

  const setpoint =
    step.extractSetpointC ??
    params.defaultExtractSetpointC ??
    DEFAULT_EXTRACT_SETPOINT_C;
  const comfortError = setpoint - tExtPrev;

  for (const signal of COMFORT_AWARE_SIGNALS) {
    const slope = slopes[signal];
    if (slope != null) u[signal] += slope * comfortError;
  }
}

export function emulateBaselineControl(
  params: BaselineEmulatorParams,
  step: MpcTimestep,
  options?: EmulateBaselineOptions,
): MpcControlVector {
  const baseFallback =
    options?.fallback ??
    mergeControlVector(params.globalMedians, DEFAULT_EMULATOR_FALLBACK);

  const u = buildTemplateControl(params, step, baseFallback);
  applyComfortErrorCorrection(u, params, step, options?.tExtPrev);

  const gated = applyBmsModeGating(u, step);

  return {
    supplySetpointC: round1Decimal(gated.supplySetpointC),
    supplyFanPct: round1Decimal(gated.supplyFanPct),
    exhaustFanPct: round1Decimal(gated.exhaustFanPct),
    heatingValvePct: round1Decimal(Math.max(0, gated.heatingValvePct)),
    coolingValvePct: round1Decimal(Math.max(0, gated.coolingValvePct)),
    districtTr002ValvePct: round1Decimal(gated.districtTr002ValvePct),
    districtTr003ValvePct: round1Decimal(gated.districtTr003ValvePct),
  };
}
