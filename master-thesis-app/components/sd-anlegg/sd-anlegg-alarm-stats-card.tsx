"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import type { InfraspawnAlarmSummary } from "@/lib/infraspawn/alarm-event-types";
import type { InfraspawnAlarmStatsPeriod } from "@/lib/infraspawn/alarm-stats-types";
import { SdAnleggAlarmSeverityLanes } from "./sd-anlegg-alarm-severity-lanes";
import { SdAnleggAlarmStatsDialog } from "./sd-anlegg-alarm-stats-dialog";
import { SdAnleggOverviewWidget } from "./sd-anlegg-overview-widget";
import { SdAnleggOverviewWidgetSkeleton } from "./sd-anlegg-overview-widget-skeleton";

type Props = {
  buildingSlug: string;
  summary: InfraspawnAlarmSummary | undefined;
  isPending: boolean;
  isError: boolean;
};

export function SdAnleggAlarmStatsCard({
  buildingSlug,
  summary,
  isPending,
  isError,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [periodDays, setPeriodDays] = useState<InfraspawnAlarmStatsPeriod>(90);
  const [selectedTypeKey, setSelectedTypeKey] = useState<string | null>(null);

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) setSelectedTypeKey(null);
  }

  return (
    <>
      <SdAnleggOverviewWidget
        title="Alarmstatistikk"
        titleId="sd-anlegg-alarm-stats-title"
        subtitle="Hendelser aktivert i dag"
        icon={BarChart3}
        footerAction={{
          label: "Alarmstatistikk",
          onClick: () => setDialogOpen(true),
        }}
      >
        {isPending ? (
          <SdAnleggOverviewWidgetSkeleton />
        ) : isError ? (
          <p className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Kunne ikke laste alarmstatistikk.
          </p>
        ) : (
          <SdAnleggAlarmSeverityLanes summary={summary} className="mt-3 space-y-1.5" />
        )}
      </SdAnleggOverviewWidget>

      <SdAnleggAlarmStatsDialog
        buildingSlug={buildingSlug}
        open={dialogOpen}
        onOpenChangeAction={handleDialogOpenChange}
        periodDays={periodDays}
        onPeriodDaysChangeAction={setPeriodDays}
        selectedTypeKey={selectedTypeKey}
        onSelectedTypeKeyChangeAction={setSelectedTypeKey}
      />
    </>
  );
}
