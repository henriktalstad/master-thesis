"use client";

import type { ControlOpsSummary } from "@/lib/sd-anlegg/control/load-control-ops-summary";
import { CONTROL_SHADOW_MODE } from "@/lib/sd-anlegg/control/control-display-labels";
import { controlStyringHref } from "@/lib/sd-anlegg/control/resolve-control-lookback";
import { Activity } from "lucide-react";
import { SdAnleggOverviewWidget } from "./sd-anlegg-overview-widget";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  summary: ControlOpsSummary;
};

function formatTickTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function SdAnleggOverviewControlStatusCard({
  buildingSlug,
  summary,
}: Props) {
  const replayKpi =
    summary.replayDeltaCostPct != null
      ? `Ca. ${Math.abs(summary.replayDeltaCostPct)} % ${summary.replayDeltaCostPct < 0 ? "lavere" : "høyere"} kost i simulering`
      : null;

  return (
    <SdAnleggOverviewWidget
      title="Styring"
      titleId="overview-control-title"
      icon={Activity}
      subtitle={
        <span className="inline-flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              summary.shadowActive
                ? "bg-emerald-500 shadow-[0_0_0_2px] shadow-emerald-500/25"
                : "bg-muted-foreground/40",
            )}
            aria-hidden
          />
          {summary.shadowActive
            ? CONTROL_SHADOW_MODE.heroActive
            : CONTROL_SHADOW_MODE.heroWaiting}
        </span>
      }
      footer={{
        href: controlStyringHref(buildingSlug, { tab: "analyse" }),
        label: replayKpi ? "Se replay-resultater" : "Åpne styring",
      }}
    >
      <dl className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        {replayKpi ? (
          <div className="flex justify-between gap-2">
            <dt>Simulering</dt>
            <dd className="font-medium text-foreground">{replayKpi}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <dt>Sist tick</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {formatTickTime(summary.lastControlTickAt)}
          </dd>
        </div>
        {summary.planDiffSummary ? (
          <div>
            <dt className="sr-only">Plan-endring</dt>
            <dd className="line-clamp-2">{summary.planDiffSummary}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <dt>Plan 24 h</dt>
          <dd className="font-medium text-foreground">
            {summary.hasForwardPlan ? "Aktiv" : "Venter"}
            {summary.hasMpcReplay
              ? summary.replayStepCount
                ? ` · ${summary.replayStepCount} replay-steg`
                : " · replay OK"
              : " · replay mangler"}
          </dd>
        </div>
      </dl>
    </SdAnleggOverviewWidget>
  );
}
