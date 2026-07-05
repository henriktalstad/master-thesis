"use client";

import type { ControlImprovementPoint } from "@/lib/sd-anlegg/control/control-types";
import { cn } from "@/lib/utils";
import { SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";

const SEVERITY_STYLES = {
  warning: "border-warning/40 bg-warning/10",
  opportunity: "border-primary/30 bg-primary/5",
  info: "border-border/80 bg-muted/15",
} as const;

type Props = {
  points: ControlImprovementPoint[];
  title?: string;
};

export function SdAnleggControlImprovementPoints({
  points,
  title = "Kort oppsummert",
}: Props) {
  if (points.length === 0) return null;

  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <ul className="space-y-2">
        {points.map((point) => (
          <li
            key={point.id}
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              SEVERITY_STYLES[point.severity],
              SD_ANLEGG_CARD,
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-foreground">{point.label}</span>
              {point.hourSpan ? (
                <span className="text-xs text-muted-foreground">{point.hourSpan}</span>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {point.detail}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
