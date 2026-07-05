"use client";

import Link from "next/link";
import type { StyringTabId } from "@/lib/sd-anlegg/control/control-styring-tabs";
import type { StyringAnalysisViewId } from "@/lib/sd-anlegg/control/control-styring-analysis-views";
import type {
  ControlLookbackDays,
  ControlPeriodMode,
  ControlStyringHrefOptions,
} from "@/lib/sd-anlegg/control/resolve-control-lookback";
import type { ThesisEvalPeriod } from "@/lib/sd-anlegg/control/control-types";
import {
  CONTROL_LOOKBACK_PRESETS,
  controlStyringHrefForExam,
  formatStyringResolutionLabel,
  type ControlDisplayStepMinutes,
} from "@/lib/sd-anlegg/control/resolve-control-lookback";
import {
  CONTROL_STYRING_PERIOD,
} from "@/lib/sd-anlegg/control/control-display-labels";
import {
  SD_ANLEGG_BTN_PRESS,
  SD_ANLEGG_FILTER_ACTIVE,
  SD_ANLEGG_FILTER_BTN,
  SD_ANLEGG_FILTER_IDLE,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";
import {
  formatControlDateTimeLabel,
  formatControlOsloDate,
  formatControlSampleTime,
  formatEvalWindow,
} from "@/lib/sd-anlegg/control/chart-utils";

type Props = {
  buildingSlug: string;
  periodMode: ControlPeriodMode;
  lookbackDays: ControlLookbackDays;
  displayStepMinutes?: ControlDisplayStepMinutes;
  displayResolutionNote?: string | null;
  tab?: StyringTabId;
  analysisView?: StyringAnalysisViewId;
  showResolution?: boolean;
  liveSampledAt?: string | null;
  evalPeriod?: ThesisEvalPeriod | null;
  examinerMode?: boolean;
  partialReplayLoaded?: number | null;
  partialReplayExpected?: number | null;
  runCreatedAt?: string | null;
};

function buildHrefOptions(input: {
  periodMode: ControlPeriodMode;
  days?: ControlLookbackDays;
  tab: StyringTabId;
  analysisView?: StyringAnalysisViewId;
}): ControlStyringHrefOptions {
  return {
    periodMode: input.periodMode,
    days: input.days,
    tab: input.tab,
    analysisView: input.tab === "analyse" ? input.analysisView : undefined,
  };
}

export function SdAnleggControlStyringContextStrip({
  buildingSlug,
  periodMode,
  lookbackDays,
  displayStepMinutes = 15,
  displayResolutionNote = null,
  tab = "na",
  analysisView,
  showResolution = tab === "na",
  liveSampledAt = null,
  evalPeriod = null,
  examinerMode = false,
  partialReplayLoaded = null,
  partialReplayExpected = null,
  runCreatedAt = null,
}: Props) {
  const evalLabel = evalPeriod ? formatEvalWindow(evalPeriod) : null;
  const showEvalPreset = evalPeriod != null;
  const partialLoaded =
    partialReplayLoaded ?? evalPeriod?.replayStepCount ?? null;
  const partialExpected = partialReplayExpected ?? evalPeriod?.stepCount ?? null;
  const showPartialReplay =
    partialLoaded != null &&
    partialExpected != null &&
    partialExpected > 0 &&
    partialLoaded < partialExpected;
  const replayCatchUpUntil =
    periodMode === "eval" && evalPeriod?.replayBehindEval
      ? formatControlOsloDate(evalPeriod.evalEnd)
      : null;
  const resolutionLabel = formatStyringResolutionLabel(
    displayStepMinutes,
    { autoHour: displayStepMinutes >= 60 },
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border/70 bg-muted/15 px-3 py-2 sm:px-4">
        <nav
          className="flex flex-wrap items-center gap-1"
          aria-label="Tidsperiode"
        >
          {showEvalPreset ? (
            <Link
              href={controlStyringHrefForExam(
                buildingSlug,
                buildHrefOptions({
                  periodMode: "eval",
                  tab,
                  analysisView,
                }),
                examinerMode,
              )}
              prefetch
              className={cn(
                SD_ANLEGG_FILTER_BTN,
                SD_ANLEGG_BTN_PRESS,
                periodMode === "eval"
                  ? SD_ANLEGG_FILTER_ACTIVE
                  : SD_ANLEGG_FILTER_IDLE,
              )}
            >
              {CONTROL_STYRING_PERIOD.evalPreset}
            </Link>
          ) : null}
          {CONTROL_LOOKBACK_PRESETS.map((preset) => {
            const href = controlStyringHrefForExam(
              buildingSlug,
              buildHrefOptions({
                periodMode: "live",
                days: preset.days,
                tab,
                analysisView,
              }),
              examinerMode,
            );
            return (
              <Link
                key={preset.days}
                href={href}
                prefetch
                className={cn(
                  SD_ANLEGG_FILTER_BTN,
                  SD_ANLEGG_BTN_PRESS,
                  periodMode === "live" && lookbackDays === preset.days
                    ? SD_ANLEGG_FILTER_ACTIVE
                    : SD_ANLEGG_FILTER_IDLE,
                )}
              >
                {preset.label}
              </Link>
            );
          })}
        </nav>

        {periodMode === "eval" && evalLabel ? (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {evalLabel}
            {evalPeriod?.stepCount ? (
              <span className="text-muted-foreground/80">
                {" "}
                · {evalPeriod.stepCount.toLocaleString("nb-NO")} intervaller
              </span>
            ) : null}
          </span>
        ) : null}

        {showPartialReplay ? (
          <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-100">
            {CONTROL_STYRING_PERIOD.partialReplayPill(
              partialLoaded!,
              partialExpected!,
            )}
          </span>
        ) : null}

        {showResolution ? (
          <span
            className="text-[11px] text-muted-foreground"
            title={displayResolutionNote ?? undefined}
          >
            {resolutionLabel}
          </span>
        ) : null}

        {runCreatedAt ? (
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
            {formatControlDateTimeLabel(runCreatedAt)}
          </span>
        ) : liveSampledAt ? (
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
            SD {formatControlSampleTime(liveSampledAt)}
          </span>
        ) : null}
      </div>

      {tab === "analyse" && periodMode === "live" ? (
        <p className="px-1 text-[11px] text-muted-foreground">
          {CONTROL_STYRING_PERIOD.analyseLiveModeNote}
        </p>
      ) : null}

      {replayCatchUpUntil ? (
        <p className="px-1 text-[11px] text-amber-800 dark:text-amber-200">
          {CONTROL_STYRING_PERIOD.replayCatchUpNote(replayCatchUpUntil)}
        </p>
      ) : null}

      {displayResolutionNote ? (
        <p className="px-1 text-[11px] text-muted-foreground">
          {displayResolutionNote}
        </p>
      ) : null}
    </div>
  );
}
