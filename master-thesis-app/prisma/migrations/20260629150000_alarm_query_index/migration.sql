DO $$
BEGIN
  IF to_regclass('public.infraspawn_alarm_events') IS NULL THEN
    RAISE NOTICE '20260629150000: hopper over — tabell mangler';
    RETURN;
  END IF;

  DROP INDEX IF EXISTS "infraspawn_alarm_events_buildingId_activatedAt_idx";
  DROP INDEX IF EXISTS "infraspawn_alarm_events_buildingId_clearedAt_idx";

  CREATE INDEX IF NOT EXISTS "infraspawn_alarm_events_buildingId_clearedAt_activatedAt_idx"
    ON "infraspawn_alarm_events" ("buildingId", "clearedAt", "activatedAt" DESC);

  CREATE INDEX IF NOT EXISTS "infraspawn_alarm_events_sourceId_clearedAt_idx"
    ON "infraspawn_alarm_events" ("sourceId", "clearedAt");
END $$;
