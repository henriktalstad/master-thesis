"use client";

import { useQuery } from "@tanstack/react-query";
import { getStyringAnalysisPayloadAction } from "@/actions/mpc-thesis";
import type { StyringAnalysisViewId } from "@/lib/sd-anlegg/control/control-styring-analysis-views";
import type {
  MpcEvalCoverageSummary,
  MpcPipelineRunRecord,
  ThesisEvalPeriod,
  ControlPlantModel,
} from "@/lib/sd-anlegg/control/control-types";
import type {
  ControlLookbackDays,
  ControlPeriodMode,
  StyringSignalGrain,
} from "@/lib/sd-anlegg/control/resolve-control-lookback";
import { SdAnleggControlAnalysisPanel } from "@/components/sd-anlegg/control/analysis/analysis-panel";
import { SdAnleggControlAnalysisPanelSkeleton } from "@/components/sd-anlegg/control/analysis/analysis-panel-skeleton";
import { styringAnalysisPayloadQueryKey } from "@/queries/styring";

type Props = {
  buildingSlug: string;
  periodMode: ControlPeriodMode;
  lookbackDays: ControlLookbackDays;
  grain: StyringSignalGrain;
  activeView: StyringAnalysisViewId;
  mpcPipelineRun: MpcPipelineRunRecord | null;
  evalPeriod?: ThesisEvalPeriod | null;
  plantModel?: ControlPlantModel | null;
  mpcEvalCoverage?: MpcEvalCoverageSummary | null;
  error?: string | null;
  examinerMode?: boolean;
};

export function SdAnleggControlAnalysisPanelLoader({
  buildingSlug,
  periodMode,
  lookbackDays,
  grain,
  activeView,
  mpcPipelineRun,
  evalPeriod = null,
  plantModel = null,
  mpcEvalCoverage = null,
  error,
  examinerMode = false,
}: Props) {
  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: styringAnalysisPayloadQueryKey(buildingSlug, activeView),
    queryFn: () =>
      getStyringAnalysisPayloadAction({ buildingSlug, view: activeView }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const mergedRun = data?.mpcPipelineRun ?? mpcPipelineRun;
  const viewLoading = isLoading || (isFetching && data == null);

  if (!mergedRun?.snapshot) {
    if (viewLoading) {
      return <SdAnleggControlAnalysisPanelSkeleton activeView={activeView} />;
    }
    return (
      <SdAnleggControlAnalysisPanel
        buildingSlug={buildingSlug}
        periodMode={periodMode}
        lookbackDays={lookbackDays}
        grain={grain}
        activeView={activeView}
        mpcPipelineRun={null}
        evalPeriod={evalPeriod}
        plantModel={plantModel}
        mpcEvalCoverage={mpcEvalCoverage}
        error={error}
        examinerMode={examinerMode}
      />
    );
  }

  return (
    <SdAnleggControlAnalysisPanel
      buildingSlug={buildingSlug}
      periodMode={periodMode}
      lookbackDays={lookbackDays}
      grain={grain}
      activeView={activeView}
      mpcPipelineRun={mergedRun}
      replaySteps={data?.replaySteps ?? []}
      stepComparison={data?.stepComparison ?? null}
      replaySignalSummary={data?.replaySignalSummary ?? null}
      mpcEnergyReconcile={data?.mpcEnergyReconcile ?? null}
      mpcEvalCharts={data?.mpcEvalCharts ?? null}
      mpcPriceLoadShift={data?.mpcPriceLoadShift ?? null}
      mpcCapacityTariff={data?.mpcCapacityTariff ?? null}
      replayRunDisplayMeta={data?.replayRunDisplayMeta ?? null}
      evalPeriod={evalPeriod}
      plantModel={plantModel}
      mpcEvalCoverage={mpcEvalCoverage}
      error={
        isError
          ? "Kunne ikke laste Effekt-data — prøv å bytte visning eller oppdater siden."
          : error
      }
      examinerMode={examinerMode}
      viewLoading={viewLoading}
    />
  );
}
