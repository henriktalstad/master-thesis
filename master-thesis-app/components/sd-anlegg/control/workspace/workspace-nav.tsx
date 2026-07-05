"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { STYRING_TABS } from "@/lib/sd-anlegg/control/control-styring-tabs";
import type { StyringTabId } from "@/lib/sd-anlegg/control/control-styring-tabs";
import type {
  ControlLookbackDays,
  ControlPeriodMode,
  StyringSignalGrain,
} from "@/lib/sd-anlegg/control/resolve-control-lookback";
import { controlStyringHrefForExam } from "@/lib/sd-anlegg/control/resolve-control-lookback";
import type { StyringTabAvailability } from "@/lib/sd-anlegg/control/resolve-styring-tab-availability";
import {
  SD_ANLEGG_BTN_PRESS,
  SD_ANLEGG_NAV_SHELL,
  SD_ANLEGG_NAV_TAB,
  SD_ANLEGG_NAV_TAB_ACTIVE,
  SD_ANLEGG_NAV_TAB_IDLE,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  activeTab: StyringTabId;
  periodMode: ControlPeriodMode;
  lookbackDays: ControlLookbackDays;
  grain?: StyringSignalGrain;
  tabs: readonly StyringTabAvailability[];
  examinerMode?: boolean;
};

export function SdAnleggControlWorkspaceNav({
  buildingSlug,
  activeTab,
  periodMode,
  lookbackDays,
  grain = "15",
  tabs,
  examinerMode = false,
}: Props) {
  const activeMeta = tabs.find((tab) => tab.id === activeTab);
  const activeDescription =
    STYRING_TABS.find((tab) => tab.id === activeTab)?.description ?? null;
  const showLockedDescription =
    activeDescription &&
    activeMeta &&
    !activeMeta.available &&
    activeTab !== "na";

  return (
    <div className="space-y-2">
      <nav aria-label="Styring-seksjoner" className={SD_ANLEGG_NAV_SHELL}>
        <div className="-mx-0.5 flex gap-0.5 overflow-x-auto px-0.5 pb-0.5 snap-x snap-mandatory scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;

            if (!tab.available) {
              return (
                <span
                  key={tab.id}
                  title={tab.reason ?? undefined}
                  aria-disabled="true"
                  className={cn(
                    SD_ANLEGG_NAV_TAB,
                    "shrink-0 snap-start cursor-not-allowed gap-1.5 opacity-45",
                    SD_ANLEGG_NAV_TAB_IDLE,
                  )}
                >
                  <Lock className="size-3 shrink-0" aria-hidden />
                  {tab.label}
                </span>
              );
            }

            return (
              <Link
                key={tab.id}
                href={controlStyringHrefForExam(
                  buildingSlug,
                  {
                    periodMode,
                    days: periodMode === "live" ? lookbackDays : undefined,
                    tab: tab.id,
                    grain,
                  },
                  examinerMode,
                )}
                prefetch
                aria-current={isActive ? "page" : undefined}
                title={tab.reason ?? (tab.available ? undefined : activeDescription) ?? undefined}
                className={cn(
                  SD_ANLEGG_NAV_TAB,
                  SD_ANLEGG_BTN_PRESS,
                  "shrink-0 snap-start",
                  isActive ? SD_ANLEGG_NAV_TAB_ACTIVE : SD_ANLEGG_NAV_TAB_IDLE,
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {showLockedDescription ? (
        <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          {activeMeta.reason ?? activeDescription}
        </p>
      ) : null}
    </div>
  );
}
