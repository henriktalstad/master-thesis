DO $$ BEGIN CREATE TYPE "MpcSimulationStatus" AS ENUM ('IDLE', 'RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "MpcReplayQuality" AS ENUM ('VALID', 'INVALID_FAN', 'INSUFFICIENT_DATA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "MpcControlTrack" AS ENUM ('OBSERVED', 'EMULATED', 'MPC', 'DEMAND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "MpcChartSeries" AS ENUM ('COST_TIMELINE', 'COMFORT', 'LOAD_PROFILE', 'EFFECT_SUMMARY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "MpcPriceLoadBand" AS ENUM ('LOW', 'MID', 'HIGH', 'PEAK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "sd_anlegg_mpc_simulation_jobs" (
  "id" TEXT NOT NULL,
  "buildingId" TEXT NOT NULL,
  "pipelineRunId" TEXT,
  "status" "MpcSimulationStatus" NOT NULL DEFAULT 'RUNNING',
  "triggerSource" TEXT NOT NULL DEFAULT 'manual',
  "inputFingerprint" TEXT,
  "stepTotal" INTEGER NOT NULL DEFAULT 0,
  "stepIndex" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ(6),
  "durationMs" INTEGER,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sd_anlegg_mpc_simulation_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_simulation_jobs_buildingId_createdAt_idx"
  ON "sd_anlegg_mpc_simulation_jobs" ("buildingId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_simulation_jobs_buildingId_status_idx"
  ON "sd_anlegg_mpc_simulation_jobs" ("buildingId", "status");

DO $$ BEGIN
  ALTER TABLE "sd_anlegg_mpc_simulation_jobs"
    ADD CONSTRAINT "sd_anlegg_mpc_simulation_jobs_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sd_anlegg_mpc_simulation_jobs"
    ADD CONSTRAINT "sd_anlegg_mpc_simulation_jobs_pipelineRunId_fkey"
    FOREIGN KEY ("pipelineRunId") REFERENCES "sd_anlegg_mpc_pipeline_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  IF to_regclass('public.sd_anlegg_live_mpc_states') IS NOT NULL THEN
    ALTER TABLE "sd_anlegg_live_mpc_states"
      ADD COLUMN IF NOT EXISTS "activeSimulationJobId" TEXT;

    CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_live_mpc_states_activeSimulationJobId_key"
      ON "sd_anlegg_live_mpc_states" ("activeSimulationJobId");

    ALTER TABLE "sd_anlegg_live_mpc_states" DROP COLUMN IF EXISTS "mpcSimulationStatus";
    ALTER TABLE "sd_anlegg_live_mpc_states" DROP COLUMN IF EXISTS "mpcSimulationStepIndex";
    ALTER TABLE "sd_anlegg_live_mpc_states" DROP COLUMN IF EXISTS "mpcSimulationStepTotal";
    ALTER TABLE "sd_anlegg_live_mpc_states" DROP COLUMN IF EXISTS "mpcSimulationMessage";
    ALTER TABLE "sd_anlegg_live_mpc_states" DROP COLUMN IF EXISTS "mpcSimulationStartedAt";
    ALTER TABLE "sd_anlegg_live_mpc_states" DROP COLUMN IF EXISTS "mpcSimulationUpdatedAt";
    ALTER TABLE "sd_anlegg_live_mpc_states" DROP COLUMN IF EXISTS "activePipelineRunId";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.sd_anlegg_live_mpc_states') IS NOT NULL THEN
    ALTER TABLE "sd_anlegg_live_mpc_states"
      ADD CONSTRAINT "sd_anlegg_live_mpc_states_activeSimulationJobId_fkey"
      FOREIGN KEY ("activeSimulationJobId") REFERENCES "sd_anlegg_mpc_simulation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "totalCostBaselineKr" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "totalCostEmulatedKr" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "totalCostMpcKr" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "totalCostDemandKr" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "deltaCostKr" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "deltaCostPct" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "deltaCostVsEmulatedKr" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "deltaCostVsEmulatedPct" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "controllableElectricKwhBaseline" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "controllableElectricKwhEmulated" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "controllableElectricKwhMpc" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "controllableHeatKwhBaseline" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "controllableHeatKwhEmulated" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "controllableHeatKwhMpc" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "peakElectricKwBaseline" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "peakElectricKwEmulated" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "peakElectricKwMpc" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "fallbackSteps" INTEGER;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "optimizablePct" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "meaningfulDeltaPct" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "plantRmseC" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "emulatorMaeSupplySetpointC" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "comfortViolationsMpc" INTEGER;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "measuredElectricityKwh" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "measuredDistrictHeatingKwh" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "measuredTotalCostKr" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "proxyEmulatedCostKr" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "proxyMpcCostKr" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "deltaMpcVsEmulatedCostKr" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "deltaMpcVsEmulatedCostPct" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "chartsGeneratedAt" TIMESTAMPTZ(6);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sd_anlegg_mpc_pipeline_runs'
      AND column_name = 'replayQuality'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE "sd_anlegg_mpc_pipeline_runs"
      ADD COLUMN IF NOT EXISTS "replayQuality_new" "MpcReplayQuality";

    UPDATE "sd_anlegg_mpc_pipeline_runs"
    SET "replayQuality_new" = CASE
      WHEN "replayQuality" = 'valid' THEN 'VALID'::"MpcReplayQuality"
      WHEN "replayQuality" = 'invalid_fan' THEN 'INVALID_FAN'::"MpcReplayQuality"
      ELSE NULL
    END
    WHERE "replayQuality" IS NOT NULL;

    ALTER TABLE "sd_anlegg_mpc_pipeline_runs" DROP COLUMN "replayQuality";
    ALTER TABLE "sd_anlegg_mpc_pipeline_runs" RENAME COLUMN "replayQuality_new" TO "replayQuality";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sd_anlegg_mpc_pipeline_runs'
      AND column_name = 'replayQuality'
  ) THEN
    ALTER TABLE "sd_anlegg_mpc_pipeline_runs"
      ADD COLUMN "replayQuality" "MpcReplayQuality";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sd_anlegg_mpc_pipeline_runs' AND column_name = 'replaySummary'
  ) THEN
    UPDATE "sd_anlegg_mpc_pipeline_runs" SET
      "totalCostBaselineKr" = COALESCE("totalCostBaselineKr", ("replaySummary"->>'totalCostBaselineKr')::double precision),
      "totalCostEmulatedKr" = COALESCE("totalCostEmulatedKr", ("replaySummary"->>'totalCostEmulatedKr')::double precision),
      "totalCostMpcKr" = COALESCE("totalCostMpcKr", ("replaySummary"->>'totalCostMpcKr')::double precision),
      "totalCostDemandKr" = COALESCE("totalCostDemandKr", ("replaySummary"->>'totalCostDemandKr')::double precision),
      "deltaCostKr" = COALESCE("deltaCostKr", ("replaySummary"->>'deltaCostKr')::double precision),
      "deltaCostPct" = COALESCE("deltaCostPct", ("replaySummary"->>'deltaCostPct')::double precision),
      "deltaCostVsEmulatedKr" = COALESCE("deltaCostVsEmulatedKr", ("replaySummary"->>'deltaCostVsEmulatedKr')::double precision),
      "deltaCostVsEmulatedPct" = COALESCE("deltaCostVsEmulatedPct", ("replaySummary"->>'deltaCostVsEmulatedPct')::double precision),
      "controllableElectricKwhBaseline" = COALESCE("controllableElectricKwhBaseline", ("replaySummary"->>'controllableElectricKwhBaseline')::double precision),
      "controllableElectricKwhEmulated" = COALESCE("controllableElectricKwhEmulated", ("replaySummary"->>'controllableElectricKwhEmulated')::double precision),
      "controllableElectricKwhMpc" = COALESCE("controllableElectricKwhMpc", ("replaySummary"->>'controllableElectricKwhMpc')::double precision),
      "controllableHeatKwhBaseline" = COALESCE("controllableHeatKwhBaseline", ("replaySummary"->>'controllableHeatKwhBaseline')::double precision),
      "controllableHeatKwhEmulated" = COALESCE("controllableHeatKwhEmulated", ("replaySummary"->>'controllableHeatKwhEmulated')::double precision),
      "controllableHeatKwhMpc" = COALESCE("controllableHeatKwhMpc", ("replaySummary"->>'controllableHeatKwhMpc')::double precision),
      "peakElectricKwBaseline" = COALESCE("peakElectricKwBaseline", ("replaySummary"->>'peakElectricKwBaseline')::double precision),
      "peakElectricKwEmulated" = COALESCE("peakElectricKwEmulated", ("replaySummary"->>'peakElectricKwEmulated')::double precision),
      "peakElectricKwMpc" = COALESCE("peakElectricKwMpc", ("replaySummary"->>'peakElectricKwMpc')::double precision),
      "fallbackSteps" = COALESCE("fallbackSteps", ("replaySummary"->>'fallbackSteps')::integer),
      "optimizablePct" = COALESCE("optimizablePct", ("replaySummary"->>'optimizablePct')::double precision),
      "meaningfulDeltaPct" = COALESCE("meaningfulDeltaPct", ("replaySummary"->>'meaningfulDeltaPct')::double precision),
      "comfortViolationsMpc" = COALESCE("comfortViolationsMpc", ("replaySummary"->>'comfortViolationsMpc')::integer)
    WHERE "replaySummary" IS NOT NULL;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'sd_anlegg_mpc_pipeline_runs' AND column_name = 'plantValidation'
    ) THEN
      UPDATE "sd_anlegg_mpc_pipeline_runs" SET
        "plantRmseC" = COALESCE("plantRmseC", ("plantValidation"->>'rmseC')::double precision),
        "emulatorMaeSupplySetpointC" = COALESCE("emulatorMaeSupplySetpointC", ("emulatorValidation"->'mae'->>'supplySetpointC')::double precision)
      WHERE "plantValidation" IS NOT NULL OR "emulatorValidation" IS NOT NULL;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sd_anlegg_mpc_pipeline_runs' AND column_name = 'energyReconcileSummary'
  ) THEN
    UPDATE "sd_anlegg_mpc_pipeline_runs" SET
      "measuredElectricityKwh" = COALESCE("measuredElectricityKwh", ("energyReconcileSummary"->'measured'->>'electricityKwh')::double precision),
      "measuredDistrictHeatingKwh" = COALESCE("measuredDistrictHeatingKwh", ("energyReconcileSummary"->'measured'->>'districtHeatingKwh')::double precision),
      "measuredTotalCostKr" = COALESCE("measuredTotalCostKr", ("energyReconcileSummary"->'measured'->>'totalCostKr')::double precision),
      "proxyEmulatedCostKr" = COALESCE("proxyEmulatedCostKr", ("energyReconcileSummary"->'proxy'->'emulated'->>'costKr')::double precision),
      "proxyMpcCostKr" = COALESCE("proxyMpcCostKr", ("energyReconcileSummary"->'proxy'->'mpc'->>'costKr')::double precision),
      "deltaMpcVsEmulatedCostKr" = COALESCE("deltaMpcVsEmulatedCostKr", ("energyReconcileSummary"->'deltaMpcVsEmulated'->>'costKr')::double precision),
      "deltaMpcVsEmulatedCostPct" = COALESCE("deltaMpcVsEmulatedCostPct", ("energyReconcileSummary"->'deltaMpcVsEmulated'->>'costPct')::double precision)
    WHERE "energyReconcileSummary" IS NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "sd_anlegg_mpc_policy_kpis" (
  "id" TEXT NOT NULL,
  "pipelineRunId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "claimLevel" TEXT NOT NULL,
  "totalCostKr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "deltaCostVsObservedKr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "deltaCostVsObservedPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "comfortViolations" INTEGER NOT NULL DEFAULT 0,
  "peakElectricKw" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "controllableElectricKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "controllableHeatKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "fallbackSteps" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sd_anlegg_mpc_policy_kpis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_mpc_policy_kpis_pipelineRunId_policyId_key"
  ON "sd_anlegg_mpc_policy_kpis" ("pipelineRunId", "policyId");
CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_policy_kpis_pipelineRunId_idx"
  ON "sd_anlegg_mpc_policy_kpis" ("pipelineRunId");
DO $$ BEGIN
  ALTER TABLE "sd_anlegg_mpc_policy_kpis"
    ADD CONSTRAINT "sd_anlegg_mpc_policy_kpis_pipelineRunId_fkey"
    FOREIGN KEY ("pipelineRunId") REFERENCES "sd_anlegg_mpc_pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "sd_anlegg_mpc_pipeline_chart_points" (
  "id" TEXT NOT NULL,
  "pipelineRunId" TEXT NOT NULL,
  "series" "MpcChartSeries" NOT NULL,
  "bucketAt" TIMESTAMPTZ(6) NOT NULL,
  "baselineKr" DOUBLE PRECISION,
  "mpcKr" DOUBLE PRECISION,
  "deltaKr" DOUBLE PRECISION,
  "extractMeasC" DOUBLE PRECISION,
  "extractPredC" DOUBLE PRECISION,
  "bandMinC" DOUBLE PRECISION,
  "bandMaxC" DOUBLE PRECISION,
  "baselineKw" DOUBLE PRECISION,
  "mpcKw" DOUBLE PRECISION,
  "emulatedKw" DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sd_anlegg_mpc_pipeline_chart_points_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mpc_chart_points_run_series_bucket_uq"
  ON "sd_anlegg_mpc_pipeline_chart_points" ("pipelineRunId", "series", "bucketAt");
CREATE INDEX IF NOT EXISTS "mpc_chart_points_run_series_bucket_idx"
  ON "sd_anlegg_mpc_pipeline_chart_points" ("pipelineRunId", "series", "bucketAt");
DO $$ BEGIN
  ALTER TABLE "sd_anlegg_mpc_pipeline_chart_points"
    ADD CONSTRAINT "sd_anlegg_mpc_pipeline_chart_points_pipelineRunId_fkey"
    FOREIGN KEY ("pipelineRunId") REFERENCES "sd_anlegg_mpc_pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "sd_anlegg_mpc_price_load_shift_bands" (
  "id" TEXT NOT NULL,
  "pipelineRunId" TEXT NOT NULL,
  "band" "MpcPriceLoadBand" NOT NULL,
  "baselineKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mpcKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "deltaKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "deltaPct" DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sd_anlegg_mpc_price_load_shift_bands_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_mpc_price_load_shift_bands_pipelineRunId_band_key"
  ON "sd_anlegg_mpc_price_load_shift_bands" ("pipelineRunId", "band");
DO $$ BEGIN
  ALTER TABLE "sd_anlegg_mpc_price_load_shift_bands"
    ADD CONSTRAINT "sd_anlegg_mpc_price_load_shift_bands_pipelineRunId_fkey"
    FOREIGN KEY ("pipelineRunId") REFERENCES "sd_anlegg_mpc_pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "proxyElKwhBaseline" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "proxyElKwhEmulated" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "proxyElKwhMpc" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "proxyElKwhDemand" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "proxyHeatKwhBaseline" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "proxyHeatKwhEmulated" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "proxyHeatKwhMpc" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "proxyHeatKwhDemand" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "electricKw" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "heatKw" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "buildingElectricityKwh" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "buildingDistrictHeatingKwh" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "extractTempMeasC" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "extractTempPredC" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "extractTempPredEmulatedC" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "extractTempPredDemandC" DOUBLE PRECISION;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "comfortViolation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "comfortViolationEmulated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "comfortViolationDemand" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sd_anlegg_mpc_pipeline_replay_steps' AND column_name = 'payload'
  ) THEN
    UPDATE "sd_anlegg_mpc_pipeline_replay_steps" SET
      "spotKrPerKwh" = COALESCE((payload->>'spotKrPerKwh')::double precision, "spotKrPerKwh"),
      "proxyElKwhBaseline" = COALESCE("proxyElKwhBaseline", (payload->>'proxyElKwhBaseline')::double precision),
      "proxyElKwhEmulated" = COALESCE("proxyElKwhEmulated", (payload->>'proxyElKwhEmulated')::double precision),
      "proxyElKwhMpc" = COALESCE("proxyElKwhMpc", (payload->>'proxyElKwhMpc')::double precision),
      "proxyElKwhDemand" = COALESCE("proxyElKwhDemand", (payload->>'proxyElKwhDemand')::double precision),
      "proxyHeatKwhBaseline" = COALESCE("proxyHeatKwhBaseline", (payload->>'proxyHeatKwhBaseline')::double precision),
      "proxyHeatKwhEmulated" = COALESCE("proxyHeatKwhEmulated", (payload->>'proxyHeatKwhEmulated')::double precision),
      "proxyHeatKwhMpc" = COALESCE("proxyHeatKwhMpc", (payload->>'proxyHeatKwhMpc')::double precision),
      "proxyHeatKwhDemand" = COALESCE("proxyHeatKwhDemand", (payload->>'proxyHeatKwhDemand')::double precision),
      "electricKw" = COALESCE("electricKw", (payload->>'electricKw')::double precision),
      "heatKw" = COALESCE("heatKw", (payload->>'heatKw')::double precision),
      "buildingElectricityKwh" = COALESCE("buildingElectricityKwh", (payload->>'buildingElectricityKwh')::double precision),
      "buildingDistrictHeatingKwh" = COALESCE("buildingDistrictHeatingKwh", (payload->>'buildingDistrictHeatingKwh')::double precision),
      "extractTempMeasC" = COALESCE("extractTempMeasC", (payload->>'extractTempMeasC')::double precision),
      "extractTempPredC" = COALESCE("extractTempPredC", (payload->>'extractTempPredC')::double precision),
      "extractTempPredEmulatedC" = COALESCE("extractTempPredEmulatedC", (payload->>'extractTempPredEmulatedC')::double precision),
      "extractTempPredDemandC" = COALESCE("extractTempPredDemandC", (payload->>'extractTempPredDemandC')::double precision),
      "comfortViolation" = COALESCE("comfortViolation", COALESCE((payload->>'comfortViolation')::boolean, false)),
      "comfortViolationEmulated" = COALESCE("comfortViolationEmulated", COALESCE((payload->>'comfortViolationEmulated')::boolean, false)),
      "comfortViolationDemand" = COALESCE("comfortViolationDemand", COALESCE((payload->>'comfortViolationDemand')::boolean, false))
    WHERE payload IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_pipeline_replay_steps_pipelineRunId_costMpcKr_idx"
  ON "sd_anlegg_mpc_pipeline_replay_steps" ("pipelineRunId", "costMpcKr");

CREATE TABLE IF NOT EXISTS "sd_anlegg_mpc_replay_control_tracks" (
  "id" TEXT NOT NULL,
  "replayStepId" TEXT NOT NULL,
  "track" "MpcControlTrack" NOT NULL,
  "supplySetpointC" DOUBLE PRECISION,
  "supplyFanPct" DOUBLE PRECISION,
  "exhaustFanPct" DOUBLE PRECISION,
  "heatingValvePct" DOUBLE PRECISION,
  "coolingValvePct" DOUBLE PRECISION,
  "districtTr002ValvePct" DOUBLE PRECISION,
  "districtTr003ValvePct" DOUBLE PRECISION,
  CONSTRAINT "sd_anlegg_mpc_replay_control_tracks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_mpc_replay_control_tracks_replayStepId_track_key"
  ON "sd_anlegg_mpc_replay_control_tracks" ("replayStepId", "track");
CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_replay_control_tracks_replayStepId_idx"
  ON "sd_anlegg_mpc_replay_control_tracks" ("replayStepId");
DO $$ BEGIN
  ALTER TABLE "sd_anlegg_mpc_replay_control_tracks"
    ADD CONSTRAINT "sd_anlegg_mpc_replay_control_tracks_replayStepId_fkey"
    FOREIGN KEY ("replayStepId") REFERENCES "sd_anlegg_mpc_pipeline_replay_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "sd_anlegg_mpc_replay_signal_values" (
  "id" TEXT NOT NULL,
  "replayStepId" TEXT NOT NULL,
  "canonicalId" TEXT NOT NULL,
  "track" "MpcControlTrack" NOT NULL,
  "value" DOUBLE PRECISION,
  CONSTRAINT "sd_anlegg_mpc_replay_signal_values_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_mpc_replay_signal_values_step_canonical_track_key"
  ON "sd_anlegg_mpc_replay_signal_values" ("replayStepId", "canonicalId", "track");
CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_replay_signal_values_replayStepId_idx"
  ON "sd_anlegg_mpc_replay_signal_values" ("replayStepId");
DO $$ BEGIN
  ALTER TABLE "sd_anlegg_mpc_replay_signal_values"
    ADD CONSTRAINT "sd_anlegg_mpc_replay_signal_values_replayStepId_fkey"
    FOREIGN KEY ("replayStepId") REFERENCES "sd_anlegg_mpc_pipeline_replay_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "sd_anlegg_mpc_pipeline_runs" DROP COLUMN IF EXISTS "emulatorValidation";
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" DROP COLUMN IF EXISTS "plantValidation";
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" DROP COLUMN IF EXISTS "replaySummary";
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" DROP COLUMN IF EXISTS "policySummaries";
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" DROP COLUMN IF EXISTS "hourlyComparison";
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" DROP COLUMN IF EXISTS "stepComparison";
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" DROP COLUMN IF EXISTS "energyReconcileSummary";
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" DROP COLUMN IF EXISTS "replaySteps";
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" DROP COLUMN IF EXISTS "uiArtifacts";
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" DROP COLUMN IF EXISTS "uiArtifactsGeneratedAt";
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" DROP COLUMN IF EXISTS "priceLoadShiftSummary";
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" DROP COLUMN IF EXISTS "preferencesSnapshot";

ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" DROP COLUMN IF EXISTS "payload";
ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" DROP COLUMN IF EXISTS "observedSignals";

DROP TABLE IF EXISTS "sd_anlegg_control_reconcile_hours";
DROP TABLE IF EXISTS "sd_anlegg_control_plan_hours";
DROP TABLE IF EXISTS "sd_anlegg_control_simulation_runs";
DROP TABLE IF EXISTS "sd_anlegg_control_plans";
