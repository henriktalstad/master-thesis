-- CreateTable
CREATE TABLE "sd_anlegg_mpc_replay_steps" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "stepAt" TIMESTAMPTZ(6) NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT 'mpc-v1',
    "calibrationFingerprint" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_anlegg_mpc_replay_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_anlegg_live_mpc_states" (
    "buildingId" TEXT NOT NULL,
    "lookbackDays" INTEGER NOT NULL DEFAULT 7,
    "modelVersion" TEXT NOT NULL DEFAULT 'mpc-v1',
    "calibrationFingerprint" TEXT NOT NULL,
    "calibration" JSONB,
    "plantRmseC" DOUBLE PRECISION,
    "emulatorMaeSupplySetpointC" DOUBLE PRECISION,
    "evalStart" TIMESTAMPTZ(6),
    "evalEnd" TIMESTAMPTZ(6),
    "replayWatermarkAt" TIMESTAMPTZ(6),
    "forwardPlan" JSONB,
    "forwardPlans" JSONB,
    "lastControlTickAt" TIMESTAMPTZ(6),
    "lastPlanDiff" JSONB,
    "activeCommand" JSONB,
    "activeSimulationJobId" TEXT,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_anlegg_live_mpc_states_pkey" PRIMARY KEY ("buildingId")
);

-- CreateIndex
CREATE UNIQUE INDEX "sd_anlegg_mpc_replay_steps_buildingId_stepAt_modelVersion_key" ON "sd_anlegg_mpc_replay_steps"("buildingId", "stepAt", "modelVersion");

-- CreateIndex
CREATE INDEX "sd_anlegg_mpc_replay_steps_buildingId_stepAt_idx" ON "sd_anlegg_mpc_replay_steps"("buildingId", "stepAt");

-- CreateIndex
CREATE INDEX "sd_anlegg_mpc_replay_steps_buildingId_calibrationFingerprint_stepAt_idx" ON "sd_anlegg_mpc_replay_steps"("buildingId", "calibrationFingerprint", "stepAt");

-- AddForeignKey
ALTER TABLE "sd_anlegg_mpc_replay_steps" ADD CONSTRAINT "sd_anlegg_mpc_replay_steps_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_anlegg_live_mpc_states" ADD CONSTRAINT "sd_anlegg_live_mpc_states_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
