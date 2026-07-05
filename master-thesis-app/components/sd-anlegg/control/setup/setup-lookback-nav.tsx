"use client";

import Link from "next/link";
import type { ControlLookbackDays } from "@/lib/sd-anlegg/control/resolve-control-lookback";
import {
  CONTROL_LOOKBACK_PRESETS,
  controlStyringHrefForExam,
} from "@/lib/sd-anlegg/control/resolve-control-lookback";
import type { StyringTabId } from "@/lib/sd-anlegg/control/control-styring-tabs";
import { CONTROL_SETUP_UI } from "@/lib/sd-anlegg/control/control-display-labels";
import {
  SD_ANLEGG_BTN_PRESS,
  SD_ANLEGG_FILTER_ACTIVE,
  SD_ANLEGG_FILTER_BTN,
  SD_ANLEGG_FILTER_IDLE,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  lookbackDays: ControlLookbackDays;
  activeTab: StyringTabId;
  examinerMode?: boolean;
};

export function SdAnleggControlSetupLookbackNav({
  buildingSlug,
  lookbackDays,
  activeTab,
  examinerMode = false,
}: Props) {
  return (
    <nav
      className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 snap-x snap-mandatory scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Historikk for live-visning"
    >
      <span className="shrink-0 snap-start pr-1 text-[11px] text-muted-foreground">
        {CONTROL_SETUP_UI.lookbackLabel}
      </span>
      {CONTROL_LOOKBACK_PRESETS.map((preset) => (
        <Link
          key={preset.days}
          href={controlStyringHrefForExam(
            buildingSlug,
            {
              periodMode: "live",
              days: preset.days,
              tab: activeTab,
            },
            examinerMode,
          )}
          prefetch
          className={cn(
            SD_ANLEGG_FILTER_BTN,
            SD_ANLEGG_BTN_PRESS,
            "shrink-0 snap-start",
            lookbackDays === preset.days
              ? SD_ANLEGG_FILTER_ACTIVE
              : SD_ANLEGG_FILTER_IDLE,
          )}
        >
          {preset.label}
        </Link>
      ))}
    </nav>
  );
}
