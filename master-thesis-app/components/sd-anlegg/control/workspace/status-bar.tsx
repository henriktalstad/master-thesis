"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import {
  ensureMpcThesisDataAction,
  recoverMpcSimulationJobAction,
} from "@/actions/mpc-thesis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  ControlDataCoverage,
  MpcEvalCoverageSummary,
  MpcPipelineRunRecord,
  ThesisEvalPeriod,
} from "@/lib/sd-anlegg/control/control-types";
import type { PipelineStatus } from "@/lib/sd-anlegg/control/resolve-pipeline-status";
import type { MpcSimulationReadiness } from "@/services/mpc/assess-mpc-simulation-readiness";
import { SD_ANLEGG_BTN_PRESS, SD_ANLEGG_INFO_BANNER } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";
import { SdAnleggControlValidationPills } from "@/components/sd-anlegg/control/shared/validation-pills";
import { SdAnleggControlPipelineStatusStrip } from "@/components/sd-anlegg/control/shared/pipeline-status-strip";
import { formatControlDateTimeLabel, formatEvalWindow } from "@/lib/sd-anlegg/control/chart-utils";
import { SdAnleggControlDatasetProvenance } from "@/components/sd-anlegg/control/shared/dataset-provenance";
import { formatMpcDatasetProvenanceLine } from "@/lib/sd-anlegg/control/format-dataset-provenance";
import type { StyringTabId } from "@/lib/sd-anlegg/control/control-styring-tabs";
import { shouldRunStyringPageRefresh } from "@/lib/sd-anlegg/control/resolve-styring-page-refresh";
import { invalidateStyringWorkspaceQueries } from "@/queries/styring";
import { CONTROL_EXAMINER_MODE, CONTROL_PIPELINE_UI, CONTROL_STYRING_PERIOD } from "@/lib/sd-anlegg/control/control-display-labels";

type Props = {
  buildingSlug: string;
  activeTab: StyringTabId;
  dataCoverage: ControlDataCoverage;
  mpcEvalCoverage: MpcEvalCoverageSummary | null;
  mpcReadiness: MpcSimulationReadiness | null;
  mpcPipelineRun: MpcPipelineRunRecord | null;
  evalPeriod: ThesisEvalPeriod | null;
  pipelineStatus: PipelineStatus;
  variant?: "full" | "compact";
  examinerMode?: boolean;
  canonicalRunId?: string | null;
  activeRunId?: string | null;
};

function formatPct(value: number): string {
  return `${Math.round(value * 100)} %`;
}

function formatEvalRange(period: ThesisEvalPeriod): string {
  return formatEvalWindow(period) ?? "—";
}

export function SdAnleggControlStatusBar({
  buildingSlug,
  activeTab,
  dataCoverage,
  mpcEvalCoverage,
  mpcReadiness,
  mpcPipelineRun,
  evalPeriod,
  pipelineStatus,
  variant = "full",
  examinerMode = false,
  canonicalRunId = null,
  activeRunId = null,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dataSourcesOpen, setDataSourcesOpen] = useState(false);

  const hasMpcRun = mpcPipelineRun?.snapshot != null;
  const canSimulate = pipelineStatus.canSimulate;
  const blockers = mpcReadiness?.blockers ?? pipelineStatus.blockers;
  const uMeasOk = (mpcEvalCoverage?.uMeasPct ?? 0) >= (mpcEvalCoverage?.thresholdPct ?? 0.8);
  const plantOk = !(mpcEvalCoverage?.needsPlantBackfill ?? false);
  const runAt = mpcPipelineRun?.createdAt
    ? formatControlDateTimeLabel(mpcPipelineRun.createdAt)
    : "—";
  const needsBackfill = pipelineStatus.needsBackfill;
  const needsSampleRefresh = mpcEvalCoverage?.needsSampleRefresh ?? false;
  const datasetLine = formatMpcDatasetProvenanceLine({
    stepCount: mpcEvalCoverage?.stepCount ?? 0,
    provenance: mpcEvalCoverage?.datasetProvenance,
    evalEnd: mpcEvalCoverage?.evalEnd,
  });

  function runEnsure(
    runSimulation: boolean,
    options?: { forceSimulationRestart?: boolean; forceDataRefresh?: boolean },
  ) {
    setStatus(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await ensureMpcThesisDataAction({
          buildingSlug,
          runSimulation,
          forceDataRefresh:
            options?.forceDataRefresh ?? (!uMeasOk || !plantOk || needsSampleRefresh),
          forceSimulationRestart: options?.forceSimulationRestart ?? false,
        });
        const detail =
          result.simulationQueued
            ? result.message
            : result.actions.length > 0
              ? `${result.message} · ${result.actions.join(" · ")}`
              : result.message;
        setStatus(detail);
        if (!result.ok) setError(result.message);
        if (result.simulationQueued) {
          await invalidateStyringWorkspaceQueries(queryClient, buildingSlug);
          return;
        }
        if (result.actions.length > 0 || result.ok) {
          await invalidateStyringWorkspaceQueries(queryClient, buildingSlug);
          if (shouldRunStyringPageRefresh({ refreshKind: "full", activeTab })) {
            router.refresh();
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ukjent feil");
      }
    });
  }

  function recoverStaleJob() {
    startTransition(async () => {
      await recoverMpcSimulationJobAction(buildingSlug);
      await invalidateStyringWorkspaceQueries(queryClient, buildingSlug);
    });
  }

  function resumeSimulation() {
    runEnsure(true, { forceSimulationRestart: false });
  }

  const thesisRunLocked =
    examinerMode &&
    canonicalRunId != null &&
    activeRunId != null &&
    canonicalRunId === activeRunId;
  const thesisRunMismatch =
    examinerMode &&
    canonicalRunId != null &&
    activeRunId != null &&
    canonicalRunId !== activeRunId;

  const simulationBusy =
    pipelineStatus.phase === "simulating" ||
    pipelineStatus.phase === "simulation_stale";

  const actionButtons = !examinerMode && mpcEvalCoverage != null && (
    <div className="flex shrink-0 flex-wrap gap-2">
      {pipelineStatus.canResumeSimulation ? (
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={resumeSimulation}
          className={cn(SD_ANLEGG_BTN_PRESS, "transition-transform duration-150 ease-out")}
        >
          {pending ? "Starter …" : "Fortsett simulering"}
        </Button>
      ) : null}
      {pipelineStatus.simulationStale ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={recoverStaleJob}
          className={cn(SD_ANLEGG_BTN_PRESS, "transition-transform duration-150 ease-out")}
        >
          {pending ? "Rydder …" : "Avbryt hengende jobb"}
        </Button>
      ) : null}
      {needsBackfill && !simulationBusy ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => runEnsure(false)}
          className={cn(SD_ANLEGG_BTN_PRESS, "transition-transform duration-150 ease-out")}
        >
          {pending ? "Henter …" : "Hent SD-data"}
        </Button>
      ) : null}
      {!simulationBusy ? (
        <Button
          type="button"
          size="sm"
          variant={hasMpcRun ? "outline" : "default"}
          disabled={pending || !canSimulate}
          title={
            !canSimulate
              ? (mpcEvalCoverage?.blockReason ?? "Utilstrekkelig SD-dekning")
              : undefined
          }
          onClick={() =>
            runEnsure(true, {
              forceSimulationRestart: hasMpcRun,
              forceDataRefresh: hasMpcRun || !uMeasOk || !plantOk || needsSampleRefresh,
            })
          }
          className={cn(SD_ANLEGG_BTN_PRESS, "transition-transform duration-150 ease-out")}
        >
          {pending ? "Starter …" : hasMpcRun ? CONTROL_STYRING_PERIOD.refreshSimulation : CONTROL_STYRING_PERIOD.runSimulation}
        </Button>
      ) : null}
    </div>
  );

  const metaRow = hasMpcRun ? (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
      <Badge variant="secondary" className="h-5 px-2 text-[10px] font-normal">
        {CONTROL_STYRING_PERIOD.simulationBadge}
      </Badge>
      {examinerMode ? (
        <Badge
          variant={thesisRunLocked ? "secondary" : "outline"}
          className={cn(
            "h-5 px-2 text-[10px] font-normal",
            thesisRunLocked && "border-emerald-500/40 bg-emerald-500/10",
            thesisRunMismatch && "border-amber-500/40 bg-amber-500/10",
          )}
        >
          {thesisRunLocked
            ? "Thesis-eval (canonical)"
            : thesisRunMismatch
              ? "Thesis-eval (annet run)"
              : "Thesis-eval"}
        </Badge>
      ) : null}
      {evalPeriod ? (
        <span className="tabular-nums">{formatEvalRange(evalPeriod)}</span>
      ) : null}
      {examinerMode ? (
        <span className="max-w-md truncate">{CONTROL_EXAMINER_MODE.thesisSnapshotNote}</span>
      ) : (
        <>
          <span aria-hidden className="text-border">
            ·
          </span>
          <span>{runAt ?? "—"}</span>
        </>
      )}
      {variant === "full" ? (
        <SdAnleggControlValidationPills mpcPipelineRun={mpcPipelineRun} />
      ) : null}
    </div>
  ) : null;

  const toneClass = cn(
    pipelineStatus.phase === "blocked" || pipelineStatus.phase === "simulation_failed"
      ? "border-amber-500/40 bg-amber-500/10"
      : pipelineStatus.phase === "ready"
        ? "border-border/80 bg-muted/20"
        : SD_ANLEGG_INFO_BANNER.replace("rounded-xl", "rounded-lg"),
  );

  return (
    <div className="space-y-2">
      <div className={cn("rounded-lg border px-4 py-3", toneClass)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <SdAnleggControlPipelineStatusStrip
              status={pipelineStatus}
              compact={variant === "compact" && hasMpcRun}
            />
            {variant === "compact" && hasMpcRun ? metaRow : null}
          </div>
          {actionButtons}
        </div>

        {variant === "full" && hasMpcRun ? (
          <div className="mt-2 border-t border-border/50 pt-2">{metaRow}</div>
        ) : null}

        {hasMpcRun && mpcEvalCoverage?.datasetProvenance ? (
          <button
            type="button"
            onClick={() => setDataSourcesOpen((v) => !v)}
            className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "size-3 transition-transform duration-150 ease-out",
                dataSourcesOpen && "rotate-180",
              )}
              aria-hidden
            />
            {dataSourcesOpen
              ? CONTROL_PIPELINE_UI.hideDataSources
              : CONTROL_PIPELINE_UI.showDataSources}
          </button>
        ) : null}

        {dataSourcesOpen && hasMpcRun && mpcEvalCoverage ? (
          <div className="mt-2 space-y-1 border-t border-border/50 pt-2 text-[11px] leading-relaxed text-muted-foreground">
            {datasetLine ? <p>{datasetLine}</p> : null}
            <SdAnleggControlDatasetProvenance
              mpcEvalCoverage={mpcEvalCoverage}
              variant="inline"
            />
          </div>
        ) : null}

        {!hasMpcRun && (mpcEvalCoverage || dataCoverage.sdCoverageNote) ? (
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "size-3 transition-transform duration-150 ease-out",
                detailsOpen && "rotate-180",
              )}
              aria-hidden
            />
            {detailsOpen ? "Skjul teknisk status" : "Vis teknisk status"}
          </button>
        ) : null}

        {detailsOpen && !hasMpcRun ? (
          <div className="mt-2 space-y-1 border-t border-border/50 pt-2 text-[11px] leading-relaxed text-muted-foreground">
            {mpcEvalCoverage ? (
              <>
                <p>
                  SD-dekning eval: {formatPct(mpcEvalCoverage.uMeasPct)} (
                  {mpcEvalCoverage.stepsWithUMeas}/{mpcEvalCoverage.stepCount} steg)
                </p>
                {mpcEvalCoverage.plantSignals.length > 0 ? (
                  <p>
                    Plant-speil ({mpcEvalCoverage.influxLookbackHours} t):{" "}
                    {formatPct(mpcEvalCoverage.plantMirrorCoveragePct)}
                    {mpcEvalCoverage.needsPlantBackfill ? " — trenger backfill" : ""}
                  </p>
                ) : null}
                {mpcEvalCoverage.datasetProvenance ? (
                  <SdAnleggControlDatasetProvenance
                    mpcEvalCoverage={mpcEvalCoverage}
                    variant="inline"
                  />
                ) : null}
              </>
            ) : null}
            {dataCoverage.sdCoverageNote ? <p>{dataCoverage.sdCoverageNote}</p> : null}
            {blockers.length > 0 ? (
              <p>Blokkeringer: {blockers.join(" · ")}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {status ? (
        <p className={cn(SD_ANLEGG_INFO_BANNER, "text-xs")}>{status}</p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
