"use client";

import { Bell } from "lucide-react";
import { useRechartsModules } from "@/components/charts/use-recharts-modules";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { InfraspawnAlarmStatsPeriod } from "@/lib/infraspawn/alarm-stats-types";
import { useSdAnleggAlarmStats } from "@/queries/infraspawn";
import { SD_ANLEGG_BTN_PRESS, SD_ANLEGG_CHART_SHELL } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

const ALARM_STATS_CHART_COLOR = "var(--destructive)";

const PERIOD_OPTIONS: ReadonlyArray<{
  days: InfraspawnAlarmStatsPeriod;
  label: string;
}> = [
  { days: 7, label: "Siste 7 dager" },
  { days: 30, label: "Siste 30 dager" },
  { days: 90, label: "Siste 3 måneder" },
];

const chartConfig = {
  count: {
    label: "Alarmer",
    color: ALARM_STATS_CHART_COLOR,
  },
} satisfies ChartConfig;

type Props = {
  buildingSlug: string;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  periodDays: InfraspawnAlarmStatsPeriod;
  onPeriodDaysChangeAction: (periodDays: InfraspawnAlarmStatsPeriod) => void;
  selectedTypeKey: string | null;
  onSelectedTypeKeyChangeAction: (typeKey: string | null) => void;
};

function formatStatsDayLabel(day: string): string {
  const date = new Date(`${day}T12:00:00`);
  return date.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
  });
}

function AlarmStatsTypeRow({
  label,
  count,
  maxCount,
  selected,
  onSelectAction,
}: {
  label: string;
  count: number;
  maxCount: number;
  selected: boolean;
  onSelectAction: () => void;
}) {
  const barWidth = maxCount > 0 ? Math.max(4, (count / maxCount) * 100) : 0;

  return (
    <li>
      <button
        type="button"
        onClick={onSelectAction}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-[background-color,border-color] duration-150 ease-out",
          SD_ANLEGG_BTN_PRESS,
          selected
            ? "border-destructive/35 border-l-[3px] border-l-destructive bg-destructive/8 pl-2.5"
            : "border-border/70 bg-muted/15 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/35",
        )}
      >
        <Bell
          className={cn(
            "size-4 shrink-0",
            selected ? "text-destructive" : "text-muted-foreground",
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          {label}
        </span>
        <div className="hidden min-w-[5rem] flex-1 sm:block">
          <div className="h-2 overflow-hidden rounded-full bg-destructive/10">
            <div
              className="h-full rounded-full bg-destructive transition-[width] duration-150 ease-out"
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {count.toLocaleString("nb-NO")}
        </span>
      </button>
    </li>
  );
}

function AlarmStatsDailyChart({
  dailyBuckets,
  isFetching,
}: {
  dailyBuckets: Array<{ day: string; count: number }>;
  isFetching: boolean;
}) {
  const recharts = useRechartsModules();
  const chartData = dailyBuckets.map((bucket) => ({
    label: formatStatsDayLabel(bucket.day),
    count: bucket.count,
  }));

  if (!recharts) {
    return <Skeleton className="h-[180px] w-full rounded-lg" />;
  }

  const { Bar, BarChart, CartesianGrid, XAxis, YAxis } = recharts;

  return (
    <div
      className={cn(
        SD_ANLEGG_CHART_SHELL,
        "transition-opacity duration-150 ease-out",
        isFetching && "opacity-60",
      )}
    >
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[188px] w-full [&_.recharts-cartesian-axis-tick_text]:text-[11px]"
      >
        <BarChart
          accessibilityLayer
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={36}
            tickMargin={4}
          />
          <ChartTooltip
            cursor={{ fill: "color-mix(in oklch, var(--muted) 55%, transparent)" }}
            labelFormatter={(label) => String(label)}
            content={<ChartTooltipContent indicator="dot" />}
          />
          <Bar
            dataKey="count"
            fill={ALARM_STATS_CHART_COLOR}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function SdAnleggAlarmStatsDialog({
  buildingSlug,
  open,
  onOpenChangeAction,
  periodDays,
  onPeriodDaysChangeAction,
  selectedTypeKey,
  onSelectedTypeKeyChangeAction,
}: Props) {
  const { data, isPending, isError, isFetching } = useSdAnleggAlarmStats(
    buildingSlug,
    periodDays,
    selectedTypeKey,
    open,
  );

  const maxTypeCount = data?.byType[0]?.count ?? 0;
  const totalCount = data?.totalCount ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-3 border-b border-border/80 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DialogTitle>Alarmstatistikk</DialogTitle>
              <DialogDescription>
                Hendelser aktivert i valgt periode
                {totalCount > 0 ? ` · ${totalCount.toLocaleString("nb-NO")} totalt` : null}
              </DialogDescription>
            </div>
            <Select
              value={String(periodDays)}
              onValueChange={(value) =>
                onPeriodDaysChangeAction(Number(value) as InfraspawnAlarmStatsPeriod)
              }
            >
              <SelectTrigger className="h-8 w-[11rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.days} value={String(option.days)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {isPending ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <Spinner variant="ring" className="size-6" />
              <p className="text-sm text-muted-foreground">Laster statistikk …</p>
            </div>
          ) : isError ? (
            <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              Kunne ikke laste alarmstatistikk.
            </p>
          ) : (
            <>
              <section aria-label="Fordeling per alarmtype">
                <ul className="space-y-1.5">
                  <AlarmStatsTypeRow
                    label="Alle typer"
                    count={totalCount}
                    maxCount={maxTypeCount}
                    selected={selectedTypeKey == null}
                    onSelectAction={() => onSelectedTypeKeyChangeAction(null)}
                  />
                  {(data?.byType ?? []).map((type) => (
                    <AlarmStatsTypeRow
                      key={type.typeKey}
                      label={type.label}
                      count={type.count}
                      maxCount={maxTypeCount}
                      selected={selectedTypeKey === type.typeKey}
                      onSelectAction={() =>
                        onSelectedTypeKeyChangeAction(type.typeKey)
                      }
                    />
                  ))}
                </ul>
                {(data?.byType.length ?? 0) === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Ingen alarmer i valgt periode.
                  </p>
                ) : null}
              </section>

              <section aria-label="Alarmer over tid">
                <h4 className="mb-2 text-sm font-medium text-foreground">
                  Antall alarmer
                </h4>
                {(data?.dailyBuckets.length ?? 0) > 0 ? (
                  <AlarmStatsDailyChart
                    dailyBuckets={data?.dailyBuckets ?? []}
                    isFetching={isFetching}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ingen data å vise for valgt filter.
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
