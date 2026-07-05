"use client";

import { SdAnleggControlClaimBadge } from "@/components/sd-anlegg/control/shared/claim-badge";
import type { ControlClaimKind } from "@/lib/sd-anlegg/control/control-claim-kinds";
import { SD_ANLEGG_KPI_CARD, SD_ANLEGG_KPI_VALUE } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  sub?: string;
  details?: readonly string[];
  claim?: ControlClaimKind;
  valueClassName?: string;
  compact?: boolean;
};

export function SdAnleggControlKpiCard({
  label,
  value,
  sub,
  details,
  claim,
  valueClassName,
  compact = false,
}: Props) {
  return (
    <div className={SD_ANLEGG_KPI_CARD}>
      <div
        className={cn(
          "border-b border-primary/15 bg-primary/4 dark:border-primary/20 dark:bg-primary/10",
          compact ? "px-3 py-2" : "px-4 py-2",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "font-medium text-muted-foreground",
              compact ? "text-[11px]" : "text-xs",
            )}
          >
            {label}
          </p>
          {claim ? <SdAnleggControlClaimBadge kind={claim} /> : null}
        </div>
      </div>
      <div className={compact ? "px-3 py-2.5" : "px-4 py-3"}>
        <p className={cn(SD_ANLEGG_KPI_VALUE, compact ? "text-base" : "text-lg", valueClassName)}>
          {value}
        </p>
        {sub ? (
          <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">{sub}</p>
        ) : null}
        {details && details.length > 0 ? (
          <ul
            className={cn(
              "space-y-0.5 text-xs tabular-nums text-muted-foreground",
              sub ? "mt-1" : "mt-1.5",
            )}
          >
            {details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
