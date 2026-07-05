CREATE TABLE "sd_anlegg_control_signal_hours" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "hourAt" TIMESTAMPTZ(6) NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT 'mpc-v1',
    "calibrationFingerprint" TEXT,
    "pipelineRunId" TEXT,
    "payload" JSONB NOT NULL,
    "stepCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sd_anlegg_control_signal_hours_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sd_anlegg_control_signal_hours_buildingId_hourAt_modelVersion_key"
    ON "sd_anlegg_control_signal_hours"("buildingId", "hourAt", "modelVersion");

CREATE INDEX "sd_anlegg_control_signal_hours_buildingId_hourAt_idx"
    ON "sd_anlegg_control_signal_hours"("buildingId", "hourAt" DESC);

ALTER TABLE "sd_anlegg_control_signal_hours"
    ADD CONSTRAINT "sd_anlegg_control_signal_hours_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
