DO $$
BEGIN
  IF to_regclass('public.sd_anlegg_live_mpc_states') IS NOT NULL THEN
    ALTER TABLE "sd_anlegg_live_mpc_states"
      ADD COLUMN IF NOT EXISTS "mpcSimulationStatus" TEXT,
      ADD COLUMN IF NOT EXISTS "mpcSimulationStepIndex" INTEGER,
      ADD COLUMN IF NOT EXISTS "mpcSimulationStepTotal" INTEGER,
      ADD COLUMN IF NOT EXISTS "mpcSimulationMessage" TEXT,
      ADD COLUMN IF NOT EXISTS "mpcSimulationStartedAt" TIMESTAMPTZ(6),
      ADD COLUMN IF NOT EXISTS "mpcSimulationUpdatedAt" TIMESTAMPTZ(6),
      ADD COLUMN IF NOT EXISTS "activePipelineRunId" TEXT;
  END IF;
END $$;

ALTER TABLE "sd_anlegg_mpc_pipeline_runs"
  ADD COLUMN IF NOT EXISTS "uiArtifactsGeneratedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "priceLoadShiftSummary" JSONB;
