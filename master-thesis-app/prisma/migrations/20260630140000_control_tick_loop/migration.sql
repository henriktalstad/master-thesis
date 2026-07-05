DO $$
BEGIN
  IF to_regclass('public.sd_anlegg_live_mpc_states') IS NOT NULL THEN
    ALTER TABLE "sd_anlegg_live_mpc_states"
      ADD COLUMN IF NOT EXISTS "lastControlTickAt" TIMESTAMPTZ(6),
      ADD COLUMN IF NOT EXISTS "lastPlanDiff" JSONB,
      ADD COLUMN IF NOT EXISTS "activeCommand" JSONB;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "sd_anlegg_control_ticks" (
  "id" TEXT NOT NULL,
  "buildingId" TEXT NOT NULL,
  "tickAt" TIMESTAMPTZ(6) NOT NULL,
  "triggerSource" TEXT NOT NULL DEFAULT 'cron',
  "modelVersion" TEXT NOT NULL DEFAULT 'mpc-v1',
  "calibrationFingerprint" TEXT NOT NULL,
  "planDiff" JSONB,
  "activeCommand" JSONB NOT NULL,
  "forwardPlanEffect" JSONB,
  "stateSnapshot" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sd_anlegg_control_ticks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sd_anlegg_control_ticks_buildingId_tickAt_idx"
  ON "sd_anlegg_control_ticks"("buildingId", "tickAt" DESC);

DO $$ BEGIN
  ALTER TABLE "sd_anlegg_control_ticks"
    ADD CONSTRAINT "sd_anlegg_control_ticks_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  IF to_regclass('public.sd_anlegg_live_mpc_states') IS NOT NULL THEN
    ALTER TABLE "sd_anlegg_control_ticks"
      ADD CONSTRAINT "sd_anlegg_control_ticks_live_mpc_state_fkey"
      FOREIGN KEY ("buildingId") REFERENCES "sd_anlegg_live_mpc_states"("buildingId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
