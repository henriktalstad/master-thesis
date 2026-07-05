ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN IF NOT EXISTS "policySummaries" JSONB;

DO $$
BEGIN
  IF to_regclass('public.sd_anlegg_live_mpc_states') IS NOT NULL THEN
    ALTER TABLE "sd_anlegg_live_mpc_states"
      ADD COLUMN IF NOT EXISTS "forwardPlans" JSONB;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "sd_anlegg_supervisory_commands" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "stepAt" TIMESTAMPTZ(6) NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'replay_step',
    "uProposed" JSONB NOT NULL,
    "uReference" JSONB,
    "status" TEXT NOT NULL DEFAULT 'predicted',
    "pipelineRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_anlegg_supervisory_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_supervisory_commands_buildingId_policyId_stepAt_kind_key"
    ON "sd_anlegg_supervisory_commands"("buildingId", "policyId", "stepAt", "kind");

CREATE INDEX IF NOT EXISTS "sd_anlegg_supervisory_commands_buildingId_policyId_stepAt_idx"
    ON "sd_anlegg_supervisory_commands"("buildingId", "policyId", "stepAt");

ALTER TABLE "sd_anlegg_supervisory_commands"
    ADD CONSTRAINT "sd_anlegg_supervisory_commands_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
