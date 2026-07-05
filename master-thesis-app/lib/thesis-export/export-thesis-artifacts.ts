import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { prisma } from "@/lib/db";
import { buildPriceLoadShiftAnalysis } from "@/lib/sd-anlegg/control/build-price-load-shift-analysis";
import type { MpcEnergyReconcileSummary } from "@/lib/sd-anlegg/control/build-mpc-energy-reconcile";
import { isIncompleteReconcileSummary } from "@/lib/sd-anlegg/control/energy-reconcile-summary-utils";
import type { MpcPipelineRunRecord } from "@/lib/sd-anlegg/control/control-types";
import { buildAnleggControlComparison } from "@/lib/sd-anlegg/control/build-anlegg-control-comparison";
import { normalizeReplaySummary } from "@/lib/sd-anlegg/control/build-control-strategy-comparison";
import { inferTuningPresetFromSolver } from "@/lib/sd-anlegg/mpc/config/mpc-tuning-presets";
import {
  buildEnergyReconcileSummaryJson,
  buildForwardPlanSummaryJson,
  buildMetricsSummaryJson,
  buildMpcCounterfactualCsv,
  buildAnleggControlComparisonJson,
  buildPolicyComparisonSummaryJson,
  buildPriceLoadAnalysisJson,
} from "./write-mpc-artifacts";
import {
  buildChartPointsJson,
  buildSupervisoryCommandsCsv,
} from "./write-thesis-db-exports";
import {
  buildCalibrationSnapshotJson,
  buildHoldoutSplitJson,
  buildModelReadinessJson,
} from "./build-thesis-export-snapshots";
import {
  resolveThesisExportOutDir,
} from "./thesis-export-paths";

export { resolveThesisProcessedDir } from "./thesis-export-paths";

export type ThesisExportResult = {
  outDir: string;
  stepCount: number;
  deltaCostKr: number;
  deltaCostPct: number;
  files: readonly string[];
};

export async function exportThesisArtifactsFromPipelineRun(
  run: MpcPipelineRunRecord,
  options?: {
    outDir?: string;
    exportRunId?: string;
    pipelineRunId?: string;
    energyReconcile?: MpcEnergyReconcileSummary | null;
  },
): Promise<ThesisExportResult> {
  const outDir = resolveThesisExportOutDir({
    outDir: options?.outDir,
    exportRunId: options?.exportRunId,
  });
  await mkdir(outDir, { recursive: true });

  const { snapshot, replaySteps, calibration } = run;
  const priceLoadShift = buildPriceLoadShiftAnalysis(replaySteps);
  const stubReconcile = run.energyReconcileSummary;
  const energyReconcile =
    options?.energyReconcile ??
    (stubReconcile && !isIncompleteReconcileSummary(stubReconcile)
      ? stubReconcile
      : null);

  await writeFile(
    resolve(outDir, "mpc_counterfactual.csv"),
    buildMpcCounterfactualCsv(replaySteps, calibration?.occupancy ?? null),
    "utf8",
  );
  await writeFile(
    resolve(outDir, "metrics_summary.json"),
    buildMetricsSummaryJson({
      modelVersion: snapshot.modelVersion,
      evalStart: snapshot.evalStart,
      evalEnd: snapshot.evalEnd,
      replaySummary: snapshot.replaySummary,
      emulatorValidation: snapshot.emulatorValidation,
      plantValidation: snapshot.plantValidation,
      powerProxy: calibration?.power ?? null,
      energyReconcile,
      priceLoadShift,
      occupancyCalibration: calibration?.occupancy ?? null,
      replaySteps,
    }),
    "utf8",
  );
  const policyComparison = snapshot.replaySummary.policySummaries ?? [];
  const tuningPreset = calibration?.solver
    ? inferTuningPresetFromSolver(calibration.solver)
    : null;
  const buildingSlug = resolveBuildingSlug();
  let wroteAnleggComparison = false;
  if (policyComparison.length > 0) {
    await writeFile(
      resolve(outDir, "policy_comparison_summary.json"),
      buildPolicyComparisonSummaryJson({
        evalStart: snapshot.evalStart,
        evalEnd: snapshot.evalEnd,
        policyComparison,
        tuningPresetId: tuningPreset?.id ?? null,
        buildingSlug,
      }),
      "utf8",
    );
    const anleggComparison = buildAnleggControlComparison({
      evalStart: snapshot.evalStart,
      evalEnd: snapshot.evalEnd,
      buildingSlug,
      replaySummary: normalizeReplaySummary(snapshot.replaySummary),
      policySummaries: policyComparison,
      tuningPresetId: tuningPreset?.id ?? null,
      energyReconcile,
      highPriceShiftPct: priceLoadShift?.highPriceCostDeltaPct ?? null,
    });
    if (anleggComparison) {
      wroteAnleggComparison = true;
      await writeFile(
        resolve(outDir, "anlegg_control_comparison.json"),
        buildAnleggControlComparisonJson(anleggComparison),
        "utf8",
      );
    }
  }
  if (priceLoadShift) {
    await writeFile(
      resolve(outDir, "price_load_analysis.json"),
      buildPriceLoadAnalysisJson(priceLoadShift),
      "utf8",
    );
  }
  if (energyReconcile) {
    await writeFile(
      resolve(outDir, "energy_reconcile_summary.json"),
      buildEnergyReconcileSummaryJson(energyReconcile),
      "utf8",
    );
  }
  await writeFile(
    resolve(outDir, "forward_plan_summary.json"),
    buildForwardPlanSummaryJson({
      modelVersion: snapshot.modelVersion,
      evalStart: snapshot.evalStart,
      evalEnd: snapshot.evalEnd,
      replaySummary: snapshot.replaySummary,
      powerProxy: calibration?.power ?? null,
      priceLoadShift,
    }),
    "utf8",
  );
  await writeFile(
    resolve(outDir, "calibration_snapshot.json"),
    buildCalibrationSnapshotJson(run),
    "utf8",
  );
  await writeFile(
    resolve(outDir, "holdout_split.json"),
    buildHoldoutSplitJson(run),
    "utf8",
  );
  await writeFile(
    resolve(outDir, "model_readiness.json"),
    buildModelReadinessJson(run),
    "utf8",
  );

  const pipelineRunId = options?.pipelineRunId ?? run.id;
  const [supervisoryRows, chartPointRows] = pipelineRunId
    ? await Promise.all([
        prisma.sdAnleggSupervisoryCommand.findMany({
          where: { pipelineRunId },
          orderBy: [{ stepAt: "asc" }, { policyId: "asc" }],
          select: {
            stepAt: true,
            policyId: true,
            kind: true,
            status: true,
            uProposed: true,
            uReference: true,
            signals: true,
          },
        }),
        prisma.sdAnleggMpcPipelineChartPoint.findMany({
          where: { pipelineRunId },
          orderBy: [{ series: "asc" }, { bucketAt: "asc" }],
        }),
      ])
    : [[], []];

  if (supervisoryRows.length > 0) {
    await writeFile(
      resolve(outDir, "supervisory_commands.csv"),
      buildSupervisoryCommandsCsv(supervisoryRows),
      "utf8",
    );
  }
  if (chartPointRows.length > 0) {
    await writeFile(
      resolve(outDir, "chart_points.json"),
      buildChartPointsJson(chartPointRows),
      "utf8",
    );
  }

  const files = [
    "mpc_counterfactual.csv",
    "metrics_summary.json",
    "calibration_snapshot.json",
    "holdout_split.json",
    "model_readiness.json",
    "forward_plan_summary.json",
    ...(policyComparison.length > 0 ? (["policy_comparison_summary.json"] as const) : []),
    ...(wroteAnleggComparison ? (["anlegg_control_comparison.json"] as const) : []),
    ...(priceLoadShift ? (["price_load_analysis.json"] as const) : []),
    ...(energyReconcile ? (["energy_reconcile_summary.json"] as const) : []),
    ...(supervisoryRows.length > 0 ? (["supervisory_commands.csv"] as const) : []),
    ...(chartPointRows.length > 0 ? (["chart_points.json"] as const) : []),
  ] as const;

  return {
    outDir,
    stepCount: replaySteps.length,
    deltaCostKr: snapshot.replaySummary.deltaCostKr,
    deltaCostPct: snapshot.replaySummary.deltaCostPct,
    files,
  };
}
