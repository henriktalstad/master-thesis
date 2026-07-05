"use client";

import Link from "next/link";
import type { StyringAnalysisViewId } from "@/lib/sd-anlegg/control/control-styring-analysis-views";
import { STYRING_ANALYSIS_VIEWS } from "@/lib/sd-anlegg/control/control-styring-analysis-views";
import type {
  ControlLookbackDays,
  ControlPeriodMode,
} from "@/lib/sd-anlegg/control/resolve-control-lookback";
import { controlStyringHrefForExam } from "@/lib/sd-anlegg/control/resolve-control-lookback";
import {
  SD_ANLEGG_ANALYSIS_NAV_ACTIVE,
  SD_ANLEGG_ANALYSIS_NAV_BTN,
  SD_ANLEGG_ANALYSIS_NAV_IDLE,
  SD_ANLEGG_ANALYSIS_NAV_SHELL,
  SD_ANLEGG_BTN_PRESS,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  periodMode: ControlPeriodMode;
  lookbackDays: ControlLookbackDays;
  activeView: StyringAnalysisViewId;
  examinerMode?: boolean;
};

export function SdAnleggControlAnalysisNav({
  buildingSlug,
  periodMode,
  lookbackDays,
  activeView,
  examinerMode = false,
}: Props) {
  const activeMeta = STYRING_ANALYSIS_VIEWS.find((v) => v.id === activeView);

  return (
    <nav aria-label="Analyse-visninger" className={SD_ANLEGG_ANALYSIS_NAV_SHELL}>
      <div className="-mb-px flex gap-1 overflow-x-auto snap-x snap-mandatory scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {STYRING_ANALYSIS_VIEWS.map((view) => {
          const isActive = view.id === activeView;
          return (
            <Link
              key={view.id}
              href={controlStyringHrefForExam(
                buildingSlug,
                {
                  periodMode,
                  days: periodMode === "live" ? lookbackDays : undefined,
                  tab: "analyse",
                  analysisView: view.id,
                },
                examinerMode,
              )}
              prefetch
              aria-current={isActive ? "page" : undefined}
              className={cn(
                SD_ANLEGG_ANALYSIS_NAV_BTN,
                SD_ANLEGG_BTN_PRESS,
                "shrink-0 snap-start",
                isActive ? SD_ANLEGG_ANALYSIS_NAV_ACTIVE : SD_ANLEGG_ANALYSIS_NAV_IDLE,
              )}
            >
              {view.label}
            </Link>
          );
        })}
      </div>
      {activeMeta?.description ? (
        <p className="mt-2 text-xs text-muted-foreground">{activeMeta.description}</p>
      ) : null}
    </nav>
  );
}
