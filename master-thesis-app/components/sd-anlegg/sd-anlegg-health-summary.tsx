import type { InfraspawnBuildingHealthSummary } from "@/lib/infraspawn/types";
import { formatRelativeMeasurementAge } from "@/lib/infraspawn/display-format";
import {
  classifyOverviewMeasurementFreshness,
  overviewMeasurementFreshnessLabel,
} from "@/lib/sd-anlegg/overview-key-point-freshness";
import { Badge } from "@/components/ui/badge";
import { SD_ANLEGG_STATUS_ATTENTION_BADGE } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  health: InfraspawnBuildingHealthSummary;
  variant?: "default" | "compact";
  isFetching?: boolean;
  todayEventCount?: number;
};

function formatAge(minutes: number | null): string {
  if (minutes == null) return "Ukjent";
  if (minutes < 1) return "Under 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 time" : `${hours} timer`;
}

/** Kun tydelige driftsavvik — ikke synklag eller manglende verdier alene. */
function requiresAttention(health: InfraspawnBuildingHealthSummary): boolean {
  return health.alarmPointCount > 0 || health.faultPointCount > 0;
}

export function SdAnleggHealthSummary({
  health,
  variant = "default",
  isFetching = false,
  todayEventCount,
}: Props) {
  const showAttentionBadge = requiresAttention(health);
  const showTodayEventsHint =
    todayEventCount != null &&
    todayEventCount > 0 &&
    todayEventCount !== health.alarmPointCount;
  const measurementFreshness = classifyOverviewMeasurementFreshness(
    health.newestSampleAt,
  );
  const freshnessHint = overviewMeasurementFreshnessLabel(measurementFreshness);

  if (variant === "compact") {
    return (
      <section
        className={cn(
          "rounded-lg border border-border/80 bg-muted/20 px-3 py-2 transition-opacity duration-150 ease-out",
          isFetching && "opacity-90",
        )}
        aria-label="Driftsstatus"
        aria-busy={isFetching || undefined}
      >
        {isFetching ? (
          <span className="sr-only">Oppdaterer driftsstatus</span>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
            <span className="font-medium text-foreground">
              {health.pointCount.toLocaleString("nb-NO")} signaler
            </span>
            <span className="hidden text-border sm:inline" aria-hidden>
              ·
            </span>
            <span className="text-muted-foreground">
              Sist oppdatert{" "}
              <span className="font-medium text-foreground">
                {formatRelativeMeasurementAge(health.newestSampleAt)}
              </span>
            </span>
            <span className="hidden text-border md:inline" aria-hidden>
              ·
            </span>
            <span className="hidden text-muted-foreground md:inline">
              {health.samplesLast24h.toLocaleString("nb-NO")} målinger / 24 t
            </span>
            <span className="hidden text-border lg:inline" aria-hidden>
              ·
            </span>
            <span className="text-muted-foreground">
              {health.unhealthyPointCount} avvik · {health.alarmPointCount} alarm
            </span>
            {showTodayEventsHint ? (
              <>
                <span className="hidden text-border lg:inline" aria-hidden>
                  ·
                </span>
                <span className="hidden text-muted-foreground lg:inline">
                  {todayEventCount === 1
                    ? "1 hendelse i dag"
                    : `${todayEventCount} hendelser i dag`}
                </span>
              </>
            ) : null}
          </div>
          {showAttentionBadge ? (
            <Badge className={SD_ANLEGG_STATUS_ATTENTION_BADGE}>
              Krever oppmerksomhet
            </Badge>
          ) : null}
        </div>
        {freshnessHint ? (
          <p className="mt-1.5 text-[11px] text-warning-foreground">{freshnessHint}</p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border/80 bg-card px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Driftsstatus</h2>
          <p className="text-sm text-muted-foreground">Målinger fra anlegget</p>
        </div>
        {showAttentionBadge ? (
          <Badge className={SD_ANLEGG_STATUS_ATTENTION_BADGE}>
            Krever oppmerksomhet
          </Badge>
        ) : null}
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2">
          <dt className="text-xs font-medium text-muted-foreground">Signaler</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {health.pointCount.toLocaleString("nb-NO")}
          </dd>
        </div>
        <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2">
          <dt className="text-xs font-medium text-muted-foreground">Sist oppdatert</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">
            {formatRelativeMeasurementAge(health.newestSampleAt)}
          </dd>
          {health.newestSampleAgeMinutes != null &&
          health.newestSampleAgeMinutes > 120 ? (
            <dd className="mt-0.5 text-xs text-muted-foreground">
              Målingen er {formatAge(health.newestSampleAgeMinutes)} gammel
            </dd>
          ) : null}
        </div>
        <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2">
          <dt className="text-xs font-medium text-muted-foreground">
            Målinger siste døgn
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {health.samplesLast24h.toLocaleString("nb-NO")}
          </dd>
        </div>
        <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2">
          <dt className="text-xs font-medium text-muted-foreground">Avvik</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">
            {health.unhealthyPointCount} avvikende · {health.alarmPointCount}{" "}
            alarm · {health.faultPointCount} feil
          </dd>
          <dd className="mt-0.5 text-xs text-muted-foreground">
            {health.noValuePointCount} uten verdi ·{" "}
            {health.outOfServicePointCount} ute av drift
          </dd>
        </div>
      </dl>
    </section>
  );
}
