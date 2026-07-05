ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps"
  ADD COLUMN IF NOT EXISTS "districtMeterTr003PowerKw" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "districtMeterTr003EnergyKwh" DOUBLE PRECISION;
