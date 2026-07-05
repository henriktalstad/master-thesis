"use client";

import type {
  ControlTickHistoryEntry,
  ControlTickState,
  LiveForwardPlans,
  MpcForwardPlan,
  MpcLiveStepSnapshot,
  MpcSignalComparison,
  ThesisEvalPeriod,
} from "@/lib/sd-anlegg/control/control-types";
import type { ControlLoopDisplaySource } from "@/lib/sd-anlegg/control/resolve-control-loop-display-steps";
import type {
  ControlLookbackDays,
  ControlPeriodMode,
  StyringSignalGrain,
} from "@/lib/sd-anlegg/control/resolve-control-lookback";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { SdAnleggControlLiveEmpty } from "@/components/sd-anlegg/control/styring/live-empty";
import { SdAnleggControlLiveStepStrip } from "@/components/sd-anlegg/control/styring/live-step-strip";
import { SdAnleggControlTickHistory } from "@/components/sd-anlegg/control/styring/tick-history";
import { SdAnleggControlMpcSignalComparison } from "@/components/sd-anlegg/control/styring/mpc-signal-comparison";
import { SdAnleggControlCollapsibleSection } from "@/components/sd-anlegg/control/shared/section";
import { SdAnleggControlLoopChart } from "@/components/sd-anlegg/control/charts/loop-chart";
import { SdAnleggControlForwardPanel } from "@/components/sd-anlegg/control/styring/forward-panel";
import { SdAnleggControlStyringContextStrip } from "@/components/sd-anlegg/control/styring/styring-context-strip";
import { SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";
import {
  CONTROL_STYRING_FORWARD,
  CONTROL_STYRING_OPS,
} from "@/lib/sd-anlegg/control/control-display-labels";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  periodMode: ControlPeriodMode;
  periodLabel: string;
  lookbackDays: ControlLookbackDays;
  grain: StyringSignalGrain;
  liveSnapshot?: MpcLiveStepSnapshot | null;
  liveSampledAt?: string | null;
  controlTickState?: ControlTickState | null;
  controlTickHistory?: readonly ControlTickHistoryEntry[];
  signalComparison?: MpcSignalComparison | null;
  controlLoopSteps?: readonly MpcReplayStep[];
  controlLoopDisplaySource?: ControlLoopDisplaySource;
  controlLoopCoverageHint?: string | null;
  controlLoopStepMinutes?: 1 | 5 | 15 | 60;
  controlLoopExpectedStepCount?: number;
  controlLoopCoverageRatio?: number;
  controlLoopResolutionNote?: string | null;
  mpcForwardPlan?: MpcForwardPlan | null;
  mpcForwardPlans?: LiveForwardPlans | null;
  replayStepCount?: number;
  evalPeriod?: ThesisEvalPeriod | null;
  planStale?: boolean;
  examinerMode?: boolean;
};

export function SdAnleggControlOpsPanel({
  buildingSlug,
  periodMode,
  periodLabel,
  lookbackDays,
  grain,
  liveSnapshot = null,
  liveSampledAt = null,
  controlTickState: _controlTickState = null,
  controlTickHistory = [],
  signalComparison = null,
  controlLoopSteps = [],
  controlLoopDisplaySource = "live-replay",
  controlLoopCoverageHint = null,
  controlLoopStepMinutes = 15,
  controlLoopExpectedStepCount,
  controlLoopCoverageRatio,
  controlLoopResolutionNote = null,
  mpcForwardPlan = null,
  mpcForwardPlans = null,
  replayStepCount,
  evalPeriod = null,
  planStale = false,
  examinerMode = false,
}: Props) {
  const hasComparison = (signalComparison?.series.length ?? 0) > 0;
  const loopSteps = controlLoopSteps.length > 0 ? controlLoopSteps : [];
  const useUnifiedOpsLayout = liveSnapshot != null && loopSteps.length > 0;

  return (
    <div className="space-y-4">
      <SdAnleggControlStyringContextStrip
        buildingSlug={buildingSlug}
        periodMode={periodMode}
        lookbackDays={lookbackDays}
        displayStepMinutes={controlLoopStepMinutes ?? 15}
        displayResolutionNote={controlLoopResolutionNote}
        liveSampledAt={liveSampledAt}
        evalPeriod={evalPeriod}
        examinerMode={examinerMode}
      />

      {liveSnapshot ? (
        <section aria-label={CONTROL_STYRING_OPS.cardTitle} className={cn(SD_ANLEGG_CARD, "overflow-hidden")}>
          <header className="border-b border-border/40 px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">{CONTROL_STYRING_OPS.cardTitle}</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {CONTROL_STYRING_OPS.cardDescription}
            </p>
          </header>
          <SdAnleggControlLiveStepStrip snapshot={liveSnapshot} planStale={planStale} />
        </section>
      ) : hasComparison ? null : (
        <section aria-label={CONTROL_STYRING_OPS.cardTitle} className={cn(SD_ANLEGG_CARD, "overflow-hidden")}>
          <SdAnleggControlLiveEmpty
            buildingSlug={buildingSlug}
            liveSampledAt={liveSampledAt}
            examinerMode={examinerMode}
            replayStepCount={replayStepCount}
          />
        </section>
      )}

      {loopSteps.length > 0 ? (
        <SdAnleggControlLoopChart
          steps={loopSteps}
          source={controlLoopDisplaySource}
          coverageHint={controlLoopCoverageHint}
          stepMinutes={controlLoopStepMinutes}
          signalComparison={useUnifiedOpsLayout ? signalComparison : null}
          expectedStepCount={controlLoopExpectedStepCount}
          coverageRatio={controlLoopCoverageRatio}
          resolutionNote={controlLoopResolutionNote}
          lookbackLabel={periodLabel}
          buildingSlug={buildingSlug}
          lookbackDays={lookbackDays}
          grain={grain}
          periodMode={periodMode}
          variant="ops"
        />
      ) : null}

      {hasComparison && !useUnifiedOpsLayout ? (
        <SdAnleggControlMpcSignalComparison
          comparison={signalComparison!}
          replayStepCount={replayStepCount}
          variant="ops"
          liveSnapshot={liveSnapshot}
          hideLiveStrip
        />
      ) : null}

      {mpcForwardPlan || mpcForwardPlans ? (
        <SdAnleggControlCollapsibleSection title={CONTROL_STYRING_FORWARD.title}>
          <SdAnleggControlForwardPanel
            mpcForwardPlan={mpcForwardPlan}
            mpcForwardPlans={mpcForwardPlans}
            embedded
          />
        </SdAnleggControlCollapsibleSection>
      ) : null}

      {controlTickHistory.length > 1 ? (
        <SdAnleggControlCollapsibleSection
          title="Planhistorikk"
          badge={`${controlTickHistory.length}`}
        >
          <SdAnleggControlTickHistory ticks={controlTickHistory} embedded />
        </SdAnleggControlCollapsibleSection>
      ) : null}
    </div>
  );
}
