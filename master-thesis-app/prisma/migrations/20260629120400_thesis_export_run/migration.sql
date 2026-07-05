DO $$
BEGIN
  IF to_regclass('public.buildings') IS NULL THEN
    RAISE NOTICE '20260629120400: hopper over — buildings mangler';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS "thesis_export_runs" (
      "id" TEXT NOT NULL,
      "buildingId" TEXT NOT NULL,
      "evalPeriodId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "inputFingerprint" TEXT,
      "manifest" JSONB,
      "errorMessage" TEXT,
      "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMPTZ(6),
      CONSTRAINT "thesis_export_runs_pkey" PRIMARY KEY ("id")
  );

  CREATE INDEX IF NOT EXISTS "thesis_export_runs_buildingId_createdAt_idx"
    ON "thesis_export_runs"("buildingId", "createdAt");

  CREATE INDEX IF NOT EXISTS "thesis_export_runs_evalPeriodId_status_idx"
    ON "thesis_export_runs"("evalPeriodId", "status");

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'thesis_export_runs_buildingId_fkey'
  ) THEN
    ALTER TABLE "thesis_export_runs"
      ADD CONSTRAINT "thesis_export_runs_buildingId_fkey"
      FOREIGN KEY ("buildingId") REFERENCES "buildings"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public.thesis_eval_periods') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'thesis_export_runs_evalPeriodId_fkey'
  ) THEN
    ALTER TABLE "thesis_export_runs"
      ADD CONSTRAINT "thesis_export_runs_evalPeriodId_fkey"
      FOREIGN KEY ("evalPeriodId") REFERENCES "thesis_eval_periods"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
