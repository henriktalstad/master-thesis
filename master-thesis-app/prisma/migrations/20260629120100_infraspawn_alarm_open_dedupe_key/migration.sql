DO $$
BEGIN
  IF to_regclass('public.infraspawn_alarm_events') IS NULL THEN
    RAISE NOTICE '20260629120100: hopper over — tabell mangler';
    RETURN;
  END IF;

  ALTER TABLE "infraspawn_alarm_events" ADD COLUMN IF NOT EXISTS "openDedupeKey" TEXT;

  CREATE UNIQUE INDEX IF NOT EXISTS "infraspawn_alarm_events_openDedupeKey_key"
    ON "infraspawn_alarm_events"("openDedupeKey");
END $$;
