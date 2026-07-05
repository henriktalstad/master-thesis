DO $$
BEGIN
  IF to_regclass('public.buildings') IS NULL THEN
    RAISE NOTICE '20260629120300: hopper over — buildings mangler';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS "thesis_eval_periods" (
      "id" TEXT NOT NULL,
      "buildingId" TEXT,
      "label" TEXT NOT NULL,
      "startDate" DATE NOT NULL,
      "endDate" DATE NOT NULL,
      "sdCoverageThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
      "isActive" BOOLEAN NOT NULL DEFAULT false,
      "metadata" JSONB DEFAULT '{}',
      "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ(6) NOT NULL,
      CONSTRAINT "thesis_eval_periods_pkey" PRIMARY KEY ("id")
  );

  CREATE INDEX IF NOT EXISTS "thesis_eval_periods_buildingId_isActive_idx"
    ON "thesis_eval_periods"("buildingId", "isActive");

  CREATE INDEX IF NOT EXISTS "thesis_eval_periods_startDate_endDate_idx"
    ON "thesis_eval_periods"("startDate", "endDate");

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'thesis_eval_periods_buildingId_fkey'
  ) THEN
    ALTER TABLE "thesis_eval_periods"
      ADD CONSTRAINT "thesis_eval_periods_buildingId_fkey"
      FOREIGN KEY ("buildingId") REFERENCES "buildings"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
