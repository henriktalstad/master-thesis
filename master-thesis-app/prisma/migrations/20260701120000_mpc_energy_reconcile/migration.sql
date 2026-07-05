ALTER TABLE "sd_anlegg_mpc_pipeline_runs"
  ADD COLUMN IF NOT EXISTS "stepComparison" JSONB,
  ADD COLUMN IF NOT EXISTS "energyReconcileSummary" JSONB;

CREATE TABLE IF NOT EXISTS "sd_anlegg_mpc_energy_reconcile_hours" (
  "id" TEXT NOT NULL,
  "pipelineRunId" TEXT NOT NULL,
  "hour" TIMESTAMPTZ(6) NOT NULL,
  "measuredElectricityKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "measuredDistrictHeatingKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "measuredCostKr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "proxyObservedElKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "proxyEmulatedElKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "proxyMpcElKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "proxyObservedHeatKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "proxyEmulatedHeatKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "proxyMpcHeatKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "proxyObservedCostKr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "proxyEmulatedCostKr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "proxyMpcCostKr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sd_anlegg_mpc_energy_reconcile_hours_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sd_anlegg_mpc_energy_reconcile_hours_pipelineRunId_hour_key"
  ON "sd_anlegg_mpc_energy_reconcile_hours"("pipelineRunId", "hour");

CREATE INDEX IF NOT EXISTS "sd_anlegg_mpc_energy_reconcile_hours_pipelineRunId_hour_idx"
  ON "sd_anlegg_mpc_energy_reconcile_hours"("pipelineRunId", "hour");

ALTER TABLE "sd_anlegg_mpc_energy_reconcile_hours"
  ADD CONSTRAINT "sd_anlegg_mpc_energy_reconcile_hours_pipelineRunId_fkey"
  FOREIGN KEY ("pipelineRunId") REFERENCES "sd_anlegg_mpc_pipeline_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
