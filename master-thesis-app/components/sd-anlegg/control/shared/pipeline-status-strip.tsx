"use client";

import type { PipelineStatus, PipelineStepState } from "@/lib/sd-anlegg/control/resolve-pipeline-status";
import { cn } from "@/lib/utils";
import { Check, Circle, Loader2 } from "lucide-react";

const STEP_STATE_STYLES: Record<
  PipelineStepState,
  { chip: string; dot: string; connector: string }
> = {
  pending: {
    chip: "border-border/60 bg-muted/20 text-muted-foreground",
    dot: "bg-muted-foreground/30",
    connector: "bg-border/60",
  },
  active: {
    chip: "border-primary/45 bg-primary/10 text-foreground shadow-sm shadow-primary/10",
    dot: "bg-primary ring-2 ring-primary/25",
    connector: "bg-primary/30",
  },
  done: {
    chip: "border-emerald-500/35 bg-emerald-500/8 text-emerald-900 dark:text-emerald-200",
    dot: "bg-emerald-500",
    connector: "bg-emerald-500/35",
  },
  warn: {
    chip: "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
    dot: "bg-amber-500",
    connector: "bg-amber-500/35",
  },
  error: {
    chip: "border-destructive/40 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    connector: "bg-destructive/30",
  },
};

function StepIcon({ state }: { state: PipelineStepState }) {
  if (state === "active") {
    return <Loader2 className="size-3 animate-spin text-primary" aria-hidden />;
  }
  if (state === "done") {
    return <Check className="size-3 text-emerald-600 dark:text-emerald-300" aria-hidden />;
  }
  return <Circle className="size-3 text-muted-foreground/50" aria-hidden />;
}

type Props = {
  status: PipelineStatus;
  compact?: boolean;
  className?: string;
};

export function SdAnleggControlPipelineStatusStrip({
  status,
  compact = false,
  className,
}: Props) {
  const showProgress =
    status.progressPct != null &&
    (status.phase === "simulating" || status.phase === "simulation_stale");

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className="flex min-w-0 items-start gap-0"
        role="list"
        aria-label="Simuleringsfremdrift"
      >
        {status.steps.map((step, index) => {
          const styles = STEP_STATE_STYLES[step.state];
          const isLast = index === status.steps.length - 1;
          return (
            <div key={step.id} className="flex min-w-0 flex-1 items-start">
              <div className="flex min-w-0 flex-col items-center gap-1.5">
                <span
                  role="listitem"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium leading-none transition-colors duration-200",
                    styles.chip,
                    step.state === "active" && "ring-1 ring-primary/20",
                  )}
                >
                  <StepIcon state={step.state} />
                  <span className="truncate">{step.label}</span>
                </span>
                <span
                  className={cn("size-1.5 rounded-full", styles.dot)}
                  aria-hidden
                />
              </div>
              {!isLast ? (
                <div
                  className={cn("mx-1 mt-4 h-px flex-1 min-w-[8px]", styles.connector)}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {!compact ? (
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium leading-snug text-foreground">
            {status.headline}
          </p>
          {status.detail ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {status.detail}
            </p>
          ) : null}
        </div>
      ) : null}

      {showProgress ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>Fremdrift</span>
            <span className="tabular-nums font-medium text-foreground">
              {status.progressPct} %
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted/50"
            role="progressbar"
            aria-valuenow={status.progressPct ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${status.progressPct}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
