ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps"
  ADD COLUMN IF NOT EXISTS "fallbackReason" TEXT;
