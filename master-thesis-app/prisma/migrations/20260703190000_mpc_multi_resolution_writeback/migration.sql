CREATE TYPE "MpcExecutionMode" AS ENUM ('SHADOW', 'SUPERVISORY', 'LIVE');
CREATE TYPE "MpcSupervisoryStatus" AS ENUM (
  'predicted',
  'approved',
  'queued',
  'published',
  'acknowledged',
  'applied',
  'rejected',
  'failed'
);

ALTER TABLE "sd_anlegg_mpc_replay_steps"
  ADD COLUMN IF NOT EXISTS "stepMinutes" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "sd_anlegg_mpc_replay_steps"
  DROP CONSTRAINT IF EXISTS "sd_anlegg_mpc_replay_steps_buildingId_stepAt_modelVersion_key";

CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_mpc_replay_steps_buildingId_stepAt_stepMinutes_modelVersion_key"
  ON "sd_anlegg_mpc_replay_steps" ("buildingId", "stepAt", "stepMinutes", "modelVersion");

CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_replay_steps_buildingId_stepMinutes_stepAt_idx"
  ON "sd_anlegg_mpc_replay_steps" ("buildingId", "stepMinutes", "stepAt");

ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps"
  ADD COLUMN IF NOT EXISTS "stepMinutes" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "sd_anlegg_mpc_pipeline_replay_steps"
  DROP CONSTRAINT IF EXISTS "sd_anlegg_mpc_pipeline_replay_steps_pipelineRunId_stepAt_key";

CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_mpc_pipeline_replay_steps_pipelineRunId_stepAt_stepMinutes_key"
  ON "sd_anlegg_mpc_pipeline_replay_steps" ("pipelineRunId", "stepAt", "stepMinutes");

CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_pipeline_replay_steps_buildingId_stepMinutes_stepAt_idx"
  ON "sd_anlegg_mpc_pipeline_replay_steps" ("buildingId", "stepMinutes", "stepAt");

ALTER TABLE "sd_anlegg_mpc_pipeline_runs"
  ADD COLUMN IF NOT EXISTS "executionMode" "MpcExecutionMode" NOT NULL DEFAULT 'SHADOW',
  ADD COLUMN IF NOT EXISTS "stepMinutes" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "sd_anlegg_mpc_simulation_jobs"
  ADD COLUMN IF NOT EXISTS "executionMode" "MpcExecutionMode" NOT NULL DEFAULT 'SHADOW',
  ADD COLUMN IF NOT EXISTS "stepMinutes" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "sd_anlegg_live_mpc_states"
  ADD COLUMN IF NOT EXISTS "executionMode" "MpcExecutionMode" NOT NULL DEFAULT 'SUPERVISORY';

CREATE TABLE IF NOT EXISTS "sd_anlegg_control_signal_buckets" (
  "id" TEXT NOT NULL,
  "buildingId" TEXT NOT NULL,
  "bucketAt" TIMESTAMPTZ(6) NOT NULL,
  "bucketMinutes" INTEGER NOT NULL,
  "sourceKind" TEXT NOT NULL DEFAULT 'mpc_replay',
  "modelVersion" TEXT NOT NULL DEFAULT 'mpc-v1',
  "calibrationFingerprint" TEXT,
  "pipelineRunId" TEXT,
  "payload" JSONB NOT NULL,
  "stepCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sd_anlegg_control_signal_buckets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_control_signal_buckets_buildingId_bucketAt_bucketMinutes_modelVersion_sourceKind_key"
  ON "sd_anlegg_control_signal_buckets" ("buildingId", "bucketAt", "bucketMinutes", "modelVersion", "sourceKind");

CREATE INDEX IF NOT EXISTS "sd_anlegg_control_signal_buckets_buildingId_bucketMinutes_bucketAt_idx"
  ON "sd_anlegg_control_signal_buckets" ("buildingId", "bucketMinutes", "bucketAt" DESC);

ALTER TABLE "sd_anlegg_control_signal_buckets"
  ADD CONSTRAINT "sd_anlegg_control_signal_buckets_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sd_anlegg_supervisory_commands"
  ADD COLUMN IF NOT EXISTS "stepMinutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "executionMode" "MpcExecutionMode" NOT NULL DEFAULT 'SUPERVISORY',
  ADD COLUMN IF NOT EXISTS "mqttTopic" TEXT,
  ADD COLUMN IF NOT EXISTS "bmsResponse" JSONB,
  ADD COLUMN IF NOT EXISTS "errorMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "acknowledgedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "appliedAt" TIMESTAMPTZ(6);

ALTER TABLE "sd_anlegg_supervisory_commands"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "sd_anlegg_supervisory_commands"
  ALTER COLUMN "status" TYPE "MpcSupervisoryStatus"
  USING (
    CASE "status"::text
      WHEN 'predicted' THEN 'predicted'::"MpcSupervisoryStatus"
      WHEN 'approved' THEN 'approved'::"MpcSupervisoryStatus"
      WHEN 'published' THEN 'published'::"MpcSupervisoryStatus"
      WHEN 'rejected' THEN 'rejected'::"MpcSupervisoryStatus"
      ELSE 'predicted'::"MpcSupervisoryStatus"
    END
  );

ALTER TABLE "sd_anlegg_supervisory_commands"
  ALTER COLUMN "status" SET DEFAULT 'predicted'::"MpcSupervisoryStatus";

CREATE INDEX IF NOT EXISTS "sd_anlegg_supervisory_commands_buildingId_status_stepAt_idx"
  ON "sd_anlegg_supervisory_commands" ("buildingId", "status", "stepAt" DESC);

INSERT INTO "sd_anlegg_control_signal_buckets" (
  "id",
  "buildingId",
  "bucketAt",
  "bucketMinutes",
  "sourceKind",
  "modelVersion",
  "calibrationFingerprint",
  "pipelineRunId",
  "payload",
  "stepCount",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "buildingId",
  "hourAt",
  60,
  'mpc_replay',
  "modelVersion",
  "calibrationFingerprint",
  "pipelineRunId",
  "payload",
  "stepCount",
  "createdAt",
  "updatedAt"
FROM "sd_anlegg_control_signal_hours"
ON CONFLICT DO NOTHING;
