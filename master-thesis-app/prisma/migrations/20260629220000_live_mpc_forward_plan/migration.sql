DO $$
BEGIN
  IF to_regclass('public.sd_anlegg_live_mpc_states') IS NOT NULL THEN
    ALTER TABLE "sd_anlegg_live_mpc_states"
      ADD COLUMN IF NOT EXISTS "forwardPlan" JSONB;
  END IF;
END $$;
