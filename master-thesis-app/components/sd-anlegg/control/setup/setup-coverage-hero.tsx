"use client";

import type {
  ControlDataQuality,
  MpcEvalCoverageSummary,
  MpcPipelineRunRecord,
} from "@/lib/sd-anlegg/control/control-types";
import { CONTROL_SETUP_UI } from "@/lib/sd-anlegg/control/control-display-labels";
import { SdAnleggControlKpiCard } from "@/components/sd-anlegg/control/shared/kpi-card";
import { SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  dataQuality: ControlDataQuality;
  sdSignalCoveragePct: number;
  mpcEvalCoverage: MpcEvalCoverageSummary | null;
  mpcPipelineRun: MpcPipelineRunRecord | null;
  className?: string;
};

export function SdAnleggControlSetupCoverageHero({
  dataQuality,
  sdSignalCoveragePct,
  mpcEvalCoverage,
  mpcPipelineRun,
  className,
}: Props) {
  const replaySteps = mpcPipelineRun?.snapshot.replaySummary?.stepCount;
  const uMeasPct =
    mpcEvalCoverage != null
      ? Math.round(mpcEvalCoverage.uMeasPct * 100)
      : null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className={cn(SD_ANLEGG_CARD, "overflow-hidden p-4 sm:p-5")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <SdAnleggControlKpiCard
            compact
            label={CONTROL_SETUP_UI.coverageSdLabel}
            claim="observed"
            value={`${dataQuality.catalogCoveragePct} %`}
            sub={CONTROL_SETUP_UI.coverageSeriesSub(
              sdSignalCoveragePct,
              dataQuality.historyDays,
            )}
          />
          <SdAnleggControlKpiCard
            compact
            label={CONTROL_SETUP_UI.coverageSimulationLabel}
            claim="simulated"
            value={
              mpcEvalCoverage
                ? mpcEvalCoverage.canSimulate
                  ? CONTROL_SETUP_UI.coverageSimulationReady
                  : CONTROL_SETUP_UI.coverageSimulationBlocked
                : "—"
            }
            sub={
              uMeasPct != null
                ? CONTROL_SETUP_UI.coverageMeasuredSub(uMeasPct)
                : CONTROL_SETUP_UI.coverageWaitingCoverage
            }
          />
          <SdAnleggControlKpiCard
            compact
            label={CONTROL_SETUP_UI.coverageModelLabel}
            claim="simulated"
            value={
              mpcPipelineRun
                ? CONTROL_SETUP_UI.coverageModelCalibrated
                : CONTROL_SETUP_UI.coverageModelWaiting
            }
            sub={
              replaySteps != null
                ? CONTROL_SETUP_UI.coverageModelIntervals(replaySteps)
                : CONTROL_SETUP_UI.coverageModelAutoRun
            }
          />
        </div>
      </div>
    </div>
  );
}
