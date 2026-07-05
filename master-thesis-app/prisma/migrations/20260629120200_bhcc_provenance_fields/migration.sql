DO $$
BEGIN
  IF to_regclass('public.building_hourly_cost_cache') IS NULL THEN
    RAISE NOTICE '20260629120200: hopper over — tabell mangler';
    RETURN;
  END IF;

  ALTER TABLE "building_hourly_cost_cache"
    ADD COLUMN IF NOT EXISTS "rollupSource" TEXT NOT NULL DEFAULT 'building_hourly_costs_sync';

  ALTER TABLE "building_hourly_cost_cache"
    ADD COLUMN IF NOT EXISTS "spotPriceSource" "EnergyPriceSource";
END $$;
