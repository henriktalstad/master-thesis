CREATE TABLE IF NOT EXISTS "sd_anlegg_mpc_pipeline_replay_steps" (
  "id" TEXT NOT NULL,
  "pipelineRunId" TEXT NOT NULL,
  "buildingId" TEXT NOT NULL,
  "stepAt" TIMESTAMPTZ(6) NOT NULL,
  "payload" JSONB NOT NULL,
  "observedSignals" JSONB,
  "spotKrPerKwh" DOUBLE PRECISION,
  "marginalKrPerKwh" DOUBLE PRECISION,
  "outdoorTempC" DOUBLE PRECISION,
  "costObservedKr" DOUBLE PRECISION,
  "costEmulatedKr" DOUBLE PRECISION,
  "costMpcKr" DOUBLE PRECISION,
  "costDemandKr" DOUBLE PRECISION,
  "usedFallback" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sd_anlegg_mpc_pipeline_replay_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_mpc_pipeline_replay_steps_pipelineRunId_stepAt_key"
  ON "sd_anlegg_mpc_pipeline_replay_steps"("pipelineRunId", "stepAt");
CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_pipeline_replay_steps_buildingId_stepAt_idx"
  ON "sd_anlegg_mpc_pipeline_replay_steps"("buildingId", "stepAt");
CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_pipeline_replay_steps_pipelineRunId_stepAt_idx"
  ON "sd_anlegg_mpc_pipeline_replay_steps"("pipelineRunId", "stepAt");

ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps"
  DROP CONSTRAINT IF EXISTS "sd_anlegg_mpc_pipeline_replay_steps_pipelineRunId_fkey";

ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps"
  ADD CONSTRAINT "sd_anlegg_mpc_pipeline_replay_steps_pipelineRunId_fkey"
  FOREIGN KEY ("pipelineRunId") REFERENCES "sd_anlegg_mpc_pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps"
  DROP CONSTRAINT IF EXISTS "sd_anlegg_mpc_pipeline_replay_steps_buildingId_fkey";

ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps"
  ADD CONSTRAINT "sd_anlegg_mpc_pipeline_replay_steps_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DELETE FROM "sd_anlegg_supervisory_commands" WHERE "pipelineRunId" IS NULL;

ALTER TABLE "sd_anlegg_supervisory_commands"
  DROP CONSTRAINT IF EXISTS "sd_anlegg_supervisory_commands_buildingId_policyId_stepAt_kind_key";

DROP INDEX IF EXISTS "sd_anlegg_supervisory_commands_buildingId_policyId_stepAt_kind_key";

ALTER TABLE "sd_anlegg_supervisory_commands"
  ALTER COLUMN "pipelineRunId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_supervisory_commands_pipelineRunId_policyId_stepAt_kind_key"
  ON "sd_anlegg_supervisory_commands"("pipelineRunId", "policyId", "stepAt", "kind");

CREATE INDEX IF NOT EXISTS "sd_anlegg_supervisory_commands_pipelineRunId_stepAt_idx"
  ON "sd_anlegg_supervisory_commands"("pipelineRunId", "stepAt");

ALTER TABLE "sd_anlegg_supervisory_commands"
  DROP CONSTRAINT IF EXISTS "sd_anlegg_supervisory_commands_pipelineRunId_fkey";

ALTER TABLE "sd_anlegg_supervisory_commands"
  ADD CONSTRAINT "sd_anlegg_supervisory_commands_pipelineRunId_fkey"
  FOREIGN KEY ("pipelineRunId") REFERENCES "sd_anlegg_mpc_pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
