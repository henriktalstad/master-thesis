"use client";

import { formatRelativeMeasurementAge } from "@/lib/infraspawn/display-format";
import { useTickingNow } from "@/hooks/use-ticking-now";
import {
  classifyOverviewMeasurementFreshness,
  overviewMeasurementFreshnessLabel,
  type OverviewMeasurementFreshness,
} from "@/lib/sd-anlegg/overview-key-point-freshness";
import { cn } from "@/lib/utils";

type Props = {
  sampledAt: string | null;
  className?: string;
};

function freshnessHintTone(freshness: OverviewMeasurementFreshness): string {
  switch (freshness) {
    case "aging":
      return "text-muted-foreground";
    case "stale":
      return "text-warning-foreground/90";
    case "fresh":
    case "unknown":
      return "text-muted-foreground";
  }
}

function freshnessDotTone(freshness: OverviewMeasurementFreshness): string {
  switch (freshness) {
    case "fresh":
      return "bg-success";
    case "aging":
      return "bg-warning/80";
    case "stale":
      return "bg-warning";
    case "unknown":
      return "bg-muted-foreground/40";
  }
}

export function SdAnleggOverviewLiveStatus({
  sampledAt,
  className,
}: Props) {
  const now = useTickingNow();
  const hydrated = now != null;
  const freshness = hydrated
    ? classifyOverviewMeasurementFreshness(sampledAt, now)
    : "unknown";
  const freshnessHint = hydrated
    ? overviewMeasurementFreshnessLabel(freshness)
    : null;
  const relativeAge =
    hydrated && sampledAt
      ? formatRelativeMeasurementAge(sampledAt, now)
      : null;

  return (
    <div
      className={cn(
        "mt-2.5 border-t border-border/50 pt-2.5 text-xs text-muted-foreground",
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex min-h-4.5 min-w-0 items-center gap-x-2 overflow-hidden">
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <span className="relative flex size-1.5 shrink-0" aria-hidden>
            <span
              className={cn("size-1.5 rounded-full", freshnessDotTone(freshness))}
            />
          </span>
          <span
            className="inline-block w-8 shrink-0"
            aria-hidden={freshness !== "fresh"}
          >
            {freshness === "fresh" ? "Live" : "\u00a0"}
          </span>
        </span>

        {sampledAt ? (
          <>
            <span className="shrink-0 text-border" aria-hidden>
              ·
            </span>
            <span className="min-w-0 truncate">
              Sist oppdatert{" "}
              <time
                dateTime={sampledAt}
                suppressHydrationWarning
                className="inline-block min-w-[10ch] font-medium tabular-nums text-foreground/80"
              >
                {relativeAge ?? "\u00a0"}
              </time>
            </span>
          </>
        ) : (
          <>
            <span className="shrink-0 text-border" aria-hidden>
              ·
            </span>
            <span className="min-w-0 truncate">Ingen data</span>
          </>
        )}
      </div>

      {freshnessHint ? (
        <p
          className={cn(
            "mt-1 truncate text-[11px] leading-tight",
            freshnessHintTone(freshness),
          )}
        >
          {freshnessHint}
        </p>
      ) : null}
    </div>
  );
}
