DO $$ BEGIN
  CREATE TYPE "MpcPersistStatus" AS ENUM ('PENDING', 'REPLAY_STEPS', 'ARTIFACTS', 'COMPLETE', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "sd_anlegg_mpc_pipeline_runs"
  ADD COLUMN IF NOT EXISTS "persistStatus" "MpcPersistStatus",
  ADD COLUMN IF NOT EXISTS "persistedStepCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "persistError" TEXT,
  ADD COLUMN IF NOT EXISTS "uiArtifacts" JSONB;

ALTER TABLE "sd_anlegg_mpc_policy_kpis"
  ADD COLUMN IF NOT EXISTS "deltaCostVsEmulatedKr" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "deltaCostVsEmulatedPct" DOUBLE PRECISION;

ALTER TABLE "sd_anlegg_mpc_pipeline_chart_points"
  ADD COLUMN IF NOT EXISTS "spotKrPerKwh" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "extractPredEmulatedC" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "extractPredDemandC" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "comfortViolationMpc" BOOLEAN;
