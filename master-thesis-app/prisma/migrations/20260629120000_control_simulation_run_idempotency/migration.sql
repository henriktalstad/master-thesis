DO $$
BEGIN
  IF to_regclass('public.sd_anlegg_control_simulation_runs') IS NULL THEN
    RAISE NOTICE '20260629120000: hopper over — tabell mangler (baseline ikke kjørt ennå)';
    RETURN;
  END IF;

  DROP INDEX IF EXISTS "sd_anlegg_control_simulation_runs_buildingId_inputFingerpri_idx";

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sd_anlegg_control_simulation_runs'
      AND column_name = 'inputFingerprint'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "sd_anlegg_control_simulation_runs"
      ALTER COLUMN "inputFingerprint" SET NOT NULL;
  END IF;

  CREATE INDEX IF NOT EXISTS "sd_anlegg_control_simulation_runs_buildingId_modelVersion_c_idx"
    ON "sd_anlegg_control_simulation_runs"("buildingId", "modelVersion", "createdAt");

  CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_control_simulation_runs_buildingId_inputFingerpri_key"
    ON "sd_anlegg_control_simulation_runs"("buildingId", "inputFingerprint", "modelVersion");
END $$;
