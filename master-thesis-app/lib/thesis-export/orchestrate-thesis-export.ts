import "server-only";

import type { MpcPipelineRunRecord } from "@/lib/sd-anlegg/control/control-types";
import { resolveEnergyReconcileForExport } from "@/lib/sd-anlegg/control/load-mpc-energy-reconcile";
import { exportEnergyComparison } from "@/lib/thesis/export-energy-comparison";
import {
  exportThesisArtifactsFromPipelineRun,
  type ThesisExportResult,
} from "./export-thesis-artifacts";

export type OrchestrateThesisExportOptions = {
  outDir?: string;
  exportRunId?: string;
  pipelineRunId?: string;
  /** UI run-scoped exports skip energy_comparison (still get reconcile in metrics). */
  includeEnergyComparison?: boolean;
};

export type OrchestrateThesisExportResult = ThesisExportResult & {
  energyReconcileIncluded: boolean;
  energyComparisonIncluded: boolean;
};

/**
 * Canonical export path shared by CLI (`export-thesis`, `thesis-mpc`) and UI action.
 */
export async function orchestrateThesisPipelineExport(input: {
  buildingId: string;
  run: MpcPipelineRunRecord;
  options?: OrchestrateThesisExportOptions;
}): Promise<OrchestrateThesisExportResult> {
  const options = input.options;
  let energyReconcile = null;
  try {
    energyReconcile = await resolveEnergyReconcileForExport({
      buildingId: input.buildingId,
      run: input.run,
    });
  } catch (error) {
    console.warn(
      "[thesis-export] energy reconcile feilet:",
      error instanceof Error ? error.message : error,
    );
  }

  const exportResult = await exportThesisArtifactsFromPipelineRun(input.run, {
    outDir: options?.outDir,
    exportRunId: options?.exportRunId,
    pipelineRunId: options?.pipelineRunId ?? input.run.id,
    energyReconcile,
  });

  const includeEnergyComparison = options?.includeEnergyComparison !== false;
  if (includeEnergyComparison) {
    try {
      await exportEnergyComparison({
        outDir: exportResult.outDir,
        pipelineRun: input.run,
        energyReconcileSummary: energyReconcile,
      });
    } catch (error) {
      console.warn(
        "[thesis-export] energy_comparison feilet:",
        error instanceof Error ? error.message : error,
      );
      return {
        ...exportResult,
        energyReconcileIncluded: energyReconcile != null,
        energyComparisonIncluded: false,
      };
    }
  }

  return {
    ...exportResult,
    energyReconcileIncluded: energyReconcile != null,
    energyComparisonIncluded: includeEnergyComparison,
  };
}
