CREATE INDEX IF NOT EXISTS "sd_anlegg_control_signal_buckets_buildingId_sourceKind_bucketMinutes_bucketAt_idx"
  ON "sd_anlegg_control_signal_buckets"("buildingId", "sourceKind", "bucketMinutes", "bucketAt" DESC);

CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_pipeline_runs_buildingId_stepCount_createdAt_idx"
  ON "sd_anlegg_mpc_pipeline_runs"("buildingId", "stepCount", "createdAt" DESC);
