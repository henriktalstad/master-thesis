ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "comfortViolationsBaseline" INTEGER;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "comfortViolationsEmulated" INTEGER;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "comfortViolationsDemand" INTEGER;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "comfortViolationsObservedProxy" INTEGER;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "comfortViolationsHarmonizedObserved" INTEGER;

ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps" ADD COLUMN IF NOT EXISTS "extractTempPredObservedC" DOUBLE PRECISION;
