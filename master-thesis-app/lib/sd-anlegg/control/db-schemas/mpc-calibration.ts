import { z } from "zod";
import type {
  EmulatorValidationMetrics,
  MpcCalibrationBundle,
  PlantValidationMetrics,
} from "@/lib/sd-anlegg/mpc/shared/types";

const partialControlVectorSchema = z
  .object({
    supplySetpointC: z.number().optional(),
    supplyFanPct: z.number().optional(),
    exhaustFanPct: z.number().optional(),
    heatingValvePct: z.number().optional(),
    coolingValvePct: z.number().optional(),
    districtTr002ValvePct: z.number().optional(),
    districtTr003ValvePct: z.number().optional(),
  })
  .passthrough();

const baselineEmulatorParamsSchema = z.object({
  version: z.enum([
    "bms-emulator-v1",
    "bms-emulator-v1.1-mode-gated",
    "bms-emulator-v1.2-plant-aware",
    "bms-emulator-v1.3-hourly-fallback",
  ]),
  templates: z.record(z.string(), partialControlVectorSchema),
  hourlyTemplates: z.record(z.string(), partialControlVectorSchema).optional(),
  weatherSlopes: partialControlVectorSchema,
  globalMedians: partialControlVectorSchema,
  comfortErrorSlopes: partialControlVectorSchema.optional(),
  defaultExtractSetpointC: z.number().optional(),
  trainNormalStepCount: z.number().int().nonnegative().optional(),
});

const plantFeatureScopeSchema = z.object({
  featureId: z.string(),
  label: z.string(),
  category: z.enum(["state", "control", "disturbance", "observation", "time"]),
  availability: z.enum(["available", "partial", "missing"]),
  usedInModel: z.boolean(),
  coveragePct: z.number().nullable(),
});

const secondaryPlantStateSchema = z.object({
  featureNames: z.array(z.string()),
  coefficients: z.array(z.number()),
  trainMae: z.number().nullable(),
  trainRmse: z.number().nullable(),
});

const plantModelParamsSchema = z.object({
  version: z.enum(["plant-v1", "plant-v2"]).optional(),
  featureNames: z.array(z.string()),
  coefficients: z.array(z.number()),
  trainMae: z.number().nullable(),
  trainRmse: z.number().nullable(),
  featureScope: z.array(plantFeatureScopeSchema),
  heatRecoveryState: secondaryPlantStateSchema.nullable().optional(),
});

const powerProxyParamsSchema = z.object({
  version: z.enum(["power-v1", "power-v2", "power-v3"]),
  betaFan: z.number(),
  betaFanFlow: z.number().nullable().optional(),
  betaHeat: z.number(),
  betaCool: z.number(),
  controllableElectricShare: z.number(),
  controllableHeatShare: z.number(),
  betaDistrictHeat: z.number().optional(),
});

const mpcSolverConfigSchema = z.object({
  horizonSteps: z.number().int().positive(),
  stepMinutes: z.literal(15),
  comfortBandC: z.object({ min: z.number(), max: z.number() }),
  lambdaMove: z.number(),
  lambdaMoveTemporal: z.number(),
  lambdaComfort: z.number(),
  lambdaPeak: z.number(),
  bounds: z.object({
    min: partialControlVectorSchema,
    max: partialControlVectorSchema,
    maxDeltaPerStep: partialControlVectorSchema,
  }),
  maxIterations: z.number().int().positive(),
  learningRate: z.number().positive(),
});

export const mpcCalibrationBundleSchema = z.object({
  modelVersion: z.enum(["mpc-v1", "mpc-v1.1-building"]),
  trainedAt: z.string(),
  trainStepCount: z.number().int().nonnegative(),
  holdoutStepCount: z.number().int().nonnegative(),
  emulator: baselineEmulatorParamsSchema,
  plant: plantModelParamsSchema,
  power: powerProxyParamsSchema,
  solver: mpcSolverConfigSchema,
});

const emulatorValidationSchema = z.object({
  comparedSteps: z.number().int().nonnegative(),
  mae: z.record(z.string(), z.number()),
  heatingModeAccuracy: z.number().nullable(),
  coolingModeAccuracy: z.number().nullable(),
});

const plantMultiStepSchema = z.object({
  horizonHours: z.number(),
  horizonSteps: z.number(),
  comparedStarts: z.number(),
  maeC: z.number(),
  rmseC: z.number(),
});

const plantValidationSchema = z.object({
  comparedSteps: z.number().int().nonnegative(),
  maeC: z.number(),
  rmseC: z.number(),
  multiStep: z.array(plantMultiStepSchema).optional(),
  featureScope: z.array(plantFeatureScopeSchema).optional(),
  heatRecoveryState: z
    .object({
      comparedSteps: z.number(),
      maeC: z.number(),
      rmseC: z.number(),
    })
    .nullable()
    .optional(),
});

const pipelineMetaSchema = z.object({
  emulatorValidation: emulatorValidationSchema,
  plantValidation: plantValidationSchema,
});

export const persistedCalibrationPayloadSchema = mpcCalibrationBundleSchema.extend({
  __pipelineMeta: pipelineMetaSchema.optional(),
});

export type ParsedCalibrationPayload = {
  calibration: MpcCalibrationBundle;
  emulatorValidation: EmulatorValidationMetrics | null;
  plantValidation: PlantValidationMetrics | null;
};

export type CalibrationParseResult =
  | { ok: true; data: ParsedCalibrationPayload }
  | { ok: false; issues: string[] };

export function parseCalibrationFromDb(value: unknown): CalibrationParseResult {
  const parsed = persistedCalibrationPayloadSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
      ),
    };
  }

  const { __pipelineMeta, ...calibrationFields } = parsed.data;
  return {
    ok: true,
    data: {
      calibration: calibrationFields as MpcCalibrationBundle,
      emulatorValidation: (__pipelineMeta?.emulatorValidation ??
        null) as EmulatorValidationMetrics | null,
      plantValidation: (__pipelineMeta?.plantValidation ??
        null) as PlantValidationMetrics | null,
    },
  };
}

export function assertCalibrationFromDb(value: unknown): ParsedCalibrationPayload {
  const result = parseCalibrationFromDb(value);
  if (!result.ok) {
    throw new Error(
      `Ugyldig calibration JSON: ${result.issues.slice(0, 3).join("; ")}`,
    );
  }
  return result.data;
}
