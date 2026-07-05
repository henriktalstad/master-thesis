"use client";

import type { ControlTickHistoryEntry } from "@/lib/sd-anlegg/control/control-types";
import { formatControlStepLabel } from "@/lib/sd-anlegg/control/chart-utils";
import { SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  ticks: readonly ControlTickHistoryEntry[];
  embedded?: boolean;
  className?: string;
};

function triggerLabel(source: string): string {
  if (source === "post_sync") return "Etter SD-sync";
  if (source === "cron") return "Planlagt";
  if (source === "manual") return "Manuell";
  return source;
}

export function SdAnleggControlTickHistory({
  ticks,
  embedded = false,
  className,
}: Props) {
  if (ticks.length === 0) return null;

  return (
    <section
      aria-label="Planhistorikk"
      className={cn(
        embedded ? undefined : SD_ANLEGG_CARD,
        embedded ? undefined : "overflow-hidden",
        className,
      )}
    >
      {!embedded ? (
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Planhistorikk</h2>
          <p className="text-xs text-muted-foreground">
            {ticks.length} siste planer
          </p>
        </div>
      ) : null}
      <ol className="max-h-56 divide-y divide-border/50 overflow-y-auto">
        {ticks.map((tick) => (
          <li key={tick.id} className="px-4 py-2.5 text-xs">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-foreground">
                {formatControlStepLabel(tick.tickAt)}
              </span>
              <span className="text-muted-foreground">{triggerLabel(tick.triggerSource)}</span>
            </div>
            <p className="mt-1 text-muted-foreground">
              {tick.planDiff?.summary ?? "Første plan"}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
