import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendBadge } from "@/components/ui/trend-badge";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle } from "lucide-react";
import { PeriodOption } from "@/types/periods";
import { getPeriodTextDisplay, cn } from "@/lib/utils";

export interface TrendData {
  value: number;
  isUp: boolean;
}

export interface DashboardCardProps {
  title: string;
  value: string | ReactNode;
  trend?: TrendData | null;
  children?: ReactNode;
  className?: string;
  actionButton?: ReactNode;
  periodOption?: PeriodOption;
  trendLabel?: string;
  upIsPositive?: boolean;
  showTitleRow?: boolean;
  valueClassName?: string;
  valueUnit?: string;
  headerClassName?: string;
  contentClassName?: string;
  trendPending?: boolean;
  trendUnavailable?: boolean;
}

export function DashboardCard({
  title,
  value,
  trend,
  children,
  className = "",
  actionButton,
  periodOption,
  trendLabel,
  upIsPositive = false,
  showTitleRow = true,
  valueClassName,
  valueUnit,
  headerClassName,
  contentClassName,
  trendPending = false,
  trendUnavailable = false,
}: DashboardCardProps) {
  const previousPeriodText = trendLabel
    ? trendLabel
    : periodOption
      ? getPeriodTextDisplay(periodOption, true)
      : "forrige periode";

  const trendValue = trend ? (trend.isUp ? trend.value : -trend.value) : null;

  const tooltipText =
    trend && trendValue !== null
      ? `${trendValue > 0 ? "+" : ""}${trendValue.toFixed(1)}% sammenlignet med ${previousPeriodText}`
      : null;

  const shouldShowTrend =
    !trendPending &&
    !trendUnavailable &&
    trend !== null &&
    trend !== undefined;

  return (
    <Card
      className={cn(
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
        "group/card relative overflow-hidden",
        "border-border/60 dark:border-border/40",
        "bg-card dark:bg-card/95",
        className,
      )}
    >
      {actionButton}
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-linear-to-br from-primary/2 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <CardHeader className={cn("pb-2 relative z-10", headerClassName)}>
        {showTitleRow ? (
          <CardDescription className="mb-1.5 text-[0.65rem] font-medium text-muted-foreground tracking-wide uppercase sm:text-xs">
            {title}
          </CardDescription>
        ) : null}
        <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2 md:gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle
              className={cn(
                "font-semibold leading-tight tracking-tight text-foreground tabular-nums wrap-break-word",
                valueUnit
                  ? cn(
                      "text-2xl sm:text-3xl lg:text-[1.75rem] xl:text-4xl",
                      valueClassName,
                    )
                  : (valueClassName ??
                      "text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl"),
              )}
            >
              {value}
            </CardTitle>
            {valueUnit ? (
              <p className="mt-1.5 text-[11px] font-medium tracking-wide text-muted-foreground normal-case sm:text-xs">
                {valueUnit}
              </p>
            ) : null}
          </div>
          {trendPending ? (
            <div className="shrink-0 sm:mt-0.5">
              <Spinner
                variant="ring"
                size={12}
                className="text-muted-foreground"
                label="Beregner sammenligning"
              />
            </div>
          ) : trendUnavailable ? (
            <div
              className="shrink-0 sm:mt-0.5 text-muted-foreground"
              title="Utilstrekkelig historisk data"
            >
              <AlertCircle className="size-3.5" aria-hidden />
            </div>
          ) : shouldShowTrend && trendValue !== null ? (
            <div className="shrink-0 sm:mt-0.5">
              <TrendBadge
                value={trendValue}
                upIsPositive={upIsPositive}
                tooltipText={tooltipText ?? undefined}
                size="sm"
                className="shadow-sm"
              />
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent
        className={cn("relative z-10 pt-1 pb-4 sm:pb-5", contentClassName)}
      >
        <div className="text-xs font-normal leading-relaxed text-muted-foreground sm:text-sm">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
