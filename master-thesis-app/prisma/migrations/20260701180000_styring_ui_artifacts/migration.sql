-- AlterTable
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN "uiArtifacts" JSONB;
ALTER TABLE "sd_anlegg_mpc_pipeline_runs" ADD COLUMN "preferencesSnapshot" JSONB;

-- CreateTable
CREATE TABLE "sd_anlegg_mpc_preferences" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "unitKey" TEXT NOT NULL,
    "overrides" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_anlegg_mpc_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sd_anlegg_mpc_preferences_buildingId_key" ON "sd_anlegg_mpc_preferences"("buildingId");

-- AddForeignKey
ALTER TABLE "sd_anlegg_mpc_preferences" ADD CONSTRAINT "sd_anlegg_mpc_preferences_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
