"use client";

import { useMemo, useState } from "react";
import type { MpcLiveStepSnapshot } from "@/lib/sd-anlegg/control/control-types";
import {
  CONTROL_DISPLAY,
  CONTROL_STYRING_OPS,
} from "@/lib/sd-anlegg/control/control-display-labels";
import { formatControlSignalValue, formatControlStepLabel } from "@/lib/sd-anlegg/control/chart-utils";
import { SdAnleggControlClaimBadge } from "@/components/sd-anlegg/control/shared/claim-badge";
import { SD_ANLEGG_INFO_BANNER } from "@/components/sd-anlegg/sd-anlegg-ui";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getLiveStripSignalValue,
  LIVE_STRIP_SIGNALS,
  resolveLiveStripLayout,
  type LiveStripSignalDeviation,
} from "@/lib/sd-anlegg/control/resolve-live-strip-layout";
import { alignedWithEstimatedHintForOccupancy } from "@/lib/sd-anlegg/mpc/config/resolve-occupancy";
import { cn } from "@/lib/utils";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";
import { ChevronDown } from "lucide-react";

type Props = {
  snapshot: MpcLiveStepSnapshot;
  planStale?: boolean;
  className?: string;
};

function vectorRows(
  vector:
    | (Partial<MpcControlVector> & { supplySetpointOperatorC?: number })
    | MpcControlVector
    | null
    | undefined,
  deviations?: LiveStripSignalDeviation[],
): Array<{
  label: string;
  value: string;
  hasDeviation: boolean;
  deltaLabel: string | null;
}> {
  return LIVE_STRIP_SIGNALS.map(({ key, label, unit }) => {
    const value = getLiveStripSignalValue(vector, key);
    const deviation = deviations?.find((row) => row.key === key);
    const formatted = formatControlSignalValue(value ?? undefined, unit);
    const deltaLabel =
      deviation?.hasDeviation && deviation.delta != null
        ? `Δ ${formatControlSignalValue(deviation.delta, unit)}`
        : null;
    return {
      label,
      value: formatted,
      hasDeviation: deviation?.hasDeviation ?? false,
      deltaLabel,
    };
  });
}

function formatKr(value: number): string {
  return value.toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SdAnleggControlLiveStepStrip({
  snapshot,
  planStale = false,
  className,
}: Props) {
  const { observed, typicalBms, mpc, deltaCostKr } = snapshot;
  const [showEstimatedManual, setShowEstimatedManual] = useState(false);

  const layout = useMemo(
    () =>
      resolveLiveStripLayout({
        observed,
        typicalBms,
        mpc,
      }),
    [observed, typicalBms, mpc],
  );

  const showEstimatedColumn = layout.showEstimatedColumn || showEstimatedManual;
  const columnCount = showEstimatedColumn ? 3 : 2;
  const simulatedVector = mpc ?? typicalBms;
  const simulatedRows = vectorRows(simulatedVector, layout.signalDeviations);
  const occupancyQ = snapshot.occupancyQ ?? 1;
  const estimatedHint = alignedWithEstimatedHintForOccupancy(
    { t: snapshot.stepAt },
    occupancyQ,
  );
  const showMisleadingEstimatedHint =
    !layout.showEstimatedColumn &&
    typicalBms &&
    !layout.hasAnyObservedVsMpcDeviation;

  const costMessage =
    deltaCostKr == null
      ? null
      : deltaCostKr < 0
        ? CONTROL_STYRING_OPS.costSaved(formatKr(Math.abs(deltaCostKr)))
        : deltaCostKr > 0
          ? CONTROL_STYRING_OPS.costHigher(formatKr(deltaCostKr))
          : CONTROL_STYRING_OPS.costNeutral;

  const controlStatusMessage = layout.hasAnyObservedVsMpcDeviation
    ? CONTROL_STYRING_OPS.controlDeviationFromMeasuredHint
    : CONTROL_STYRING_OPS.alignedWithMeasuredHint;

  return (
    <div aria-label={CONTROL_STYRING_OPS.liveStripAria} className={cn(className)}>
      <p className="border-b border-border/40 px-4 py-2 text-[11px] text-muted-foreground">
        {formatControlStepLabel(snapshot.sampledAt)}
        {snapshot.occupancyLabel ? (
          <span className="text-foreground/80"> · {snapshot.occupancyLabel}</span>
        ) : null}
        {snapshot.comfortBandMinC != null && snapshot.comfortBandMaxC != null ? (
          <span className="text-foreground/70">
            {" "}
            ·{" "}
            {CONTROL_STYRING_OPS.comfortBandLabel(
              snapshot.comfortBandMinC,
              snapshot.comfortBandMaxC,
            )}
          </span>
        ) : null}
        {planStale ? (
          <span className="text-amber-800 dark:text-amber-200">
            {" "}
            · {CONTROL_STYRING_OPS.planRefreshingHint}
          </span>
        ) : null}
      </p>

      <div
        className={cn(
          "grid grid-cols-1 gap-3 p-4 motion-safe:transition-[grid-template-columns] motion-safe:duration-200",
          columnCount === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        <LiveStepColumn
          title={CONTROL_DISPLAY.observed.short}
          claim="observed"
          rows={vectorRows(observed)}
        />
        {showEstimatedColumn ? (
          <LiveStepColumn
            title={CONTROL_DISPLAY.predicted.chart}
            claim="estimated"
            rows={vectorRows(typicalBms)}
          />
        ) : null}
        <LiveStepColumn
          title={CONTROL_DISPLAY.simulatedControl.opsShort}
          claim="simulated"
          rows={simulatedRows}
          highlightDeviations
        />
      </div>

      {!layout.showEstimatedColumn && typicalBms ? (
        <div className="px-4 pb-2">
          {showMisleadingEstimatedHint ? (
            <p className="mb-2 text-[11px] text-muted-foreground">{estimatedHint}</p>
          ) : null}
          <Collapsible open={showEstimatedManual} onOpenChange={setShowEstimatedManual}>
            <CollapsibleTrigger className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:underline">
              <ChevronDown
                className={cn(
                  "size-3 transition-transform motion-safe:duration-200",
                  showEstimatedManual && "rotate-180",
                )}
                aria-hidden
              />
              {showEstimatedManual
                ? CONTROL_STYRING_OPS.hideEstimatedColumnLabel
                : CONTROL_STYRING_OPS.showEstimatedColumnLabel}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <LiveStepColumn
                title={CONTROL_DISPLAY.predicted.chart}
                claim="estimated"
                rows={vectorRows(typicalBms)}
                compact
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      ) : null}

      <div className="mx-4 mb-4 space-y-1.5">
        {costMessage ? (
          <p
            className={cn(
              SD_ANLEGG_INFO_BANNER,
              "text-xs",
              deltaCostKr != null && deltaCostKr < 0
                ? "text-emerald-900 dark:text-emerald-100"
                : deltaCostKr != null && deltaCostKr > 0
                  ? "text-amber-900 dark:text-amber-100"
                  : undefined,
            )}
          >
            {costMessage}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{CONTROL_STYRING_OPS.noCostYet}</p>
        )}
        <p
          className={cn(
            "text-xs",
            layout.hasAnyObservedVsMpcDeviation
              ? "text-amber-900 dark:text-amber-200"
              : "text-muted-foreground",
          )}
        >
          {controlStatusMessage}
        </p>
      </div>
    </div>
  );
}

function LiveStepColumn({
  title,
  claim,
  rows,
  highlightDeviations = false,
  compact = false,
}: {
  title: string;
  claim: "observed" | "estimated" | "simulated";
  rows: Array<{
    label: string;
    value: string;
    hasDeviation?: boolean;
    deltaLabel?: string | null;
  }>;
  highlightDeviations?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-background/80 px-3 py-2.5",
        compact && "bg-muted/20",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{title}</p>
        <SdAnleggControlClaimBadge kind={claim} />
      </div>
      <dl className="space-y-1">
        {rows.map(({ label, value, hasDeviation, deltaLabel }) => (
          <div
            key={label}
            className={cn(
              "flex justify-between gap-2 rounded px-1 py-0.5 text-xs",
              highlightDeviations &&
                hasDeviation &&
                "bg-amber-500/5 text-amber-950 dark:text-amber-100",
            )}
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="flex items-baseline gap-1.5 font-medium tabular-nums text-foreground">
              <span>{value}</span>
              {highlightDeviations && deltaLabel ? (
                <span className="text-[10px] font-normal text-muted-foreground">
                  {deltaLabel}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
