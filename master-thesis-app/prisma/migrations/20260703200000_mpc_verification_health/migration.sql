ALTER TABLE "sd_anlegg_mpc_pipeline_runs"
  ADD COLUMN IF NOT EXISTS "verificationHealth" TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_pipeline_replay_steps_pipelineRunId_usedFallback_idx"
  ON "sd_anlegg_mpc_pipeline_replay_steps" ("pipelineRunId", "usedFallback");
