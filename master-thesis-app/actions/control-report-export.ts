"use server";

import { revalidatePath } from "next/cache";
import { unstable_noStore as noStore } from "next/cache";
import { isCurrentUserAdmin } from "@/actions/auth";
import { prisma } from "@/lib/db";
import { resolveInfraspawnBuildingForRead } from "@/lib/infraspawn/read-access";
import { loadMpcPipelineRunByIdForExport } from "@/lib/sd-anlegg/control/load-mpc-pipeline-run";
import {
  orchestrateThesisPipelineExport,
  type OrchestrateThesisExportResult,
} from "@/lib/thesis-export/orchestrate-thesis-export";
import { resolveThesisExportOutDir } from "@/lib/thesis-export/thesis-export-paths";

export type ExportControlReportActionInput = {
  buildingSlug: string;
  pipelineRunId: string;
};

export type ExportControlReportActionResult =
  | {
      ok: true;
      message: string;
      export: OrchestrateThesisExportResult;
      exportRunId: string;
    }
  | { ok: false; message: string };

async function assertStyringAccess(buildingSlug: string): Promise<{
  buildingId: string;
}> {
  const [readCtx, isAdmin] = await Promise.all([
    resolveInfraspawnBuildingForRead(buildingSlug),
    isCurrentUserAdmin(),
  ]);
  if (!readCtx.ok && !isAdmin) {
    throw new Error(readCtx.error ?? "Ingen tilgang");
  }
  if (!readCtx.ok) {
    throw new Error("Bygg ikke funnet");
  }
  return { buildingId: readCtx.building.id };
}

export async function exportControlReportAction(
  input: ExportControlReportActionInput,
): Promise<ExportControlReportActionResult> {
  noStore();
  const { buildingId } = await assertStyringAccess(input.buildingSlug);

  const run = await loadMpcPipelineRunByIdForExport(input.pipelineRunId);
  if (!run || run.snapshot == null) {
    return { ok: false, message: "Fant ikke pipeline-run for eksport" };
  }

  const owned = await prisma.sdAnleggMpcPipelineRun.findFirst({
    where: { id: input.pipelineRunId, buildingId },
    select: { id: true, inputFingerprint: true },
  });
  if (!owned) {
    return { ok: false, message: "Pipeline-run tilhører ikke dette bygget" };
  }

  const exportRun = await prisma.thesisExportRun.create({
    data: {
      buildingId,
      status: "pending",
      inputFingerprint: owned.inputFingerprint,
    },
    select: { id: true },
  });

  try {
    const exportResult = await orchestrateThesisPipelineExport({
      buildingId,
      run,
      options: {
        exportRunId: exportRun.id,
        pipelineRunId: run.id,
        outDir: resolveThesisExportOutDir({ exportRunId: exportRun.id }),
        includeEnergyComparison: true,
      },
    });

    await prisma.thesisExportRun.update({
      where: { id: exportRun.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        manifest: {
          files: [...exportResult.files],
          outDir: exportResult.outDir,
          pipelineRunId: run.id,
          stepCount: exportResult.stepCount,
          deltaCostPct: exportResult.deltaCostPct,
          energyReconcileIncluded: exportResult.energyReconcileIncluded,
          energyComparisonIncluded: exportResult.energyComparisonIncluded,
        },
      },
    });

    revalidatePath(`/sd-anlegg/${input.buildingSlug}/styring`);

    return {
      ok: true,
      exportRunId: exportRun.id,
      export: exportResult,
      message: `Eksportert ${exportResult.files.length} filer til ${exportResult.outDir}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil";
    await prisma.thesisExportRun.update({
      where: { id: exportRun.id },
      data: {
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
      },
    });
    return { ok: false, message };
  }
}
