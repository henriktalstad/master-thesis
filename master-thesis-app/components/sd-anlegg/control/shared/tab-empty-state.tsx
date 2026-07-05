"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import type { StyringTabId } from "@/lib/sd-anlegg/control/control-styring-tabs";
import type {
  ControlLookbackDays,
  ControlPeriodMode,
} from "@/lib/sd-anlegg/control/resolve-control-lookback";
import { controlStyringHref } from "@/lib/sd-anlegg/control/resolve-control-lookback";
import type { StyringTabAvailability } from "@/lib/sd-anlegg/control/resolve-styring-tab-availability";
import { SD_ANLEGG_BTN_PRESS, SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  periodMode: ControlPeriodMode;
  lookbackDays: ControlLookbackDays;
  tabId: StyringTabId;
  tabLabel: string;
  reason: string;
  fallbackTab: StyringTabAvailability | undefined;
};

export function SdAnleggControlTabEmptyState({
  buildingSlug,
  periodMode,
  lookbackDays,
  tabId,
  tabLabel,
  reason,
  fallbackTab,
}: Props) {
  return (
    <div
      className={cn(
        SD_ANLEGG_CARD,
        "flex flex-col items-center gap-3 rounded-xl px-6 py-12 text-center",
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
        <Lock className="size-4" aria-hidden />
      </div>
      <div className="max-w-md space-y-1">
        <p className="text-sm font-medium text-foreground">
          {tabLabel} er ikke tilgjengelig ennå
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">{reason}</p>
      </div>
      {fallbackTab && fallbackTab.id !== tabId ? (
        <Link
          href={controlStyringHref(buildingSlug, {
            periodMode,
            days: periodMode === "live" ? lookbackDays : undefined,
            tab: fallbackTab.id,
          })}
          prefetch
          className={cn(
            "mt-1 inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground",
            SD_ANLEGG_BTN_PRESS,
            "transition-transform duration-150 ease-out",
          )}
        >
          Gå til {fallbackTab.label}
        </Link>
      ) : null}
    </div>
  );
}
