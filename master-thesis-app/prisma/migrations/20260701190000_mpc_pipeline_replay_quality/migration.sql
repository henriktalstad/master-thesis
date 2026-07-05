ALTER TABLE "sd_anlegg_mpc_pipeline_runs"
  ADD COLUMN IF NOT EXISTS "replayQuality" TEXT,
  ADD COLUMN IF NOT EXISTS "signalBindingVersion" TEXT;

CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_pipeline_runs_buildingId_replayQuality_createdAt_idx"
  ON "sd_anlegg_mpc_pipeline_runs" ("buildingId", "replayQuality", "createdAt");
