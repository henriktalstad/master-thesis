"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Loader2,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CoffeeCupIcon } from "@/components/ui/processing/CoffeeCupIcon";
import { useSmoothedNumber } from "@/hooks/useSmoothedNumber";
import type { IngestUiStep, IngestUiStepStatus } from "@/lib/floor-plan";

type MetaItem = { label: string; value: string };

export type ProcessingPanelProps = {
  title: string;
  subtitle?: string;
  /**
   * Target progress (0-100). Rendres “smooth”.
   * For indeterminate/lasting kan du sende en lav verdi + `activeIcon`.
   */
  progress: number;
  steps?: IngestUiStep[];
  meta?: MetaItem[];
  footer?: React.ReactNode;
  className?: string;
  activeIcon?: boolean;
  status?: "processing" | "done" | "error";
  /** Viser liten detaljlinje under tittel (kan skjules for “kun det brukeren trenger”). */
  hintText?: string;
  /**
   * Skjult som standard, vises kun når bruker ber om det.
   * Bruk dette til kort, relevant “debug” som logs / feilsteg.
   */
  details?: {
    label?: string;
    content: React.ReactNode;
  };
};

function StepStatusIcon({ status }: { status: IngestUiStepStatus }) {
  if (status === "completed") return <Check className="size-3.5 shrink-0" />;
  if (status === "active")
    return <Loader2 className="size-3.5 shrink-0 animate-spin" />;
  if (status === "failed") return <XCircle className="size-3.5 shrink-0" />;
  return <Circle className="size-3 shrink-0 opacity-60" />;
}

export function ProcessingPanel({
  title,
  subtitle,
  progress,
  steps,
  meta,
  footer,
  className,
  activeIcon = false,
  status = "processing",
  hintText,
  details,
}: ProcessingPanelProps) {
  const smoothed = useSmoothedNumber(progress, {
    intervalMs: 40,
    maxDeltaPerTick: 1.4,
  });
  const pct = Math.round(Math.max(0, Math.min(100, smoothed)));
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <output
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground p-4 sm:p-5",
        status === "error" && "border-destructive/25 bg-destructive/5",
        status === "done" && "border-primary/15 bg-primary/5",
        className,
      )}
      data-processing-status={status}
      
      aria-live="polite"
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex size-16 items-center justify-center rounded-xl border",
            status === "error"
              ? "bg-destructive/10 border-destructive/20"
              : status === "done"
                ? "bg-primary/10 border-primary/15"
                : "bg-muted/40 border-border",
          )}
        >
          <CoffeeCupIcon
            progress={pct}
            size={44}
            active={activeIcon || status === "processing"}
            alwaysAnimate={status === "processing"}
          />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {title}
              </p>
              {subtitle ? (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {subtitle}
                </p>
              ) : null}
              {hintText ? (
                <p className="text-xs text-muted-foreground mt-1">{hintText}</p>
              ) : null}
            </div>

            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-lg font-bold tabular-nums",
                  status === "error"
                    ? "text-destructive"
                    : status === "done"
                      ? "text-primary"
                      : "text-primary",
                )}
                aria-label={`${pct} prosent`}
              >
                {pct}%
              </p>
              <p className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
                {status === "done"
                  ? "Ferdig"
                  : status === "error"
                    ? "Feilet"
                    : "Prosesserer"}
              </p>
            </div>
          </div>

          <Progress value={pct} className="h-1.5" />

          {meta?.length ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
              {meta.map((m) => (
                <div key={m.label} className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {m.label}
                  </span>
                  <span className="text-[12px] font-semibold text-foreground/80">
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {steps?.length ? (
            <div className="pt-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Steg
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {steps.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                      s.status === "completed" &&
                        "bg-primary/10 border-primary/15 text-primary",
                      s.status === "active" &&
                        "bg-primary/10 border-primary/25 text-foreground",
                      s.status === "pending" &&
                        "bg-muted/30 border-border text-muted-foreground",
                      s.status === "failed" &&
                        "bg-destructive/10 border-destructive/20 text-destructive",
                    )}
                  >
                    <StepStatusIcon status={s.status} />
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">{s.label}</p>
                      {s.description ? (
                        <p className="mt-0.5 text-[11px] leading-snug opacity-85">
                          {s.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {details ? (
            <div className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-2 -ml-2 h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowDetails((v) => !v)}
                aria-expanded={showDetails}
              >
                {showDetails ? (
                  <ChevronUp className="size-4 mr-1.5" />
                ) : (
                  <ChevronDown className="size-4 mr-1.5" />
                )}
                {showDetails
                  ? "Skjul detaljer"
                  : (details.label ?? "Vis detaljer")}
              </Button>

              {showDetails ? (
                <div className="mt-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {details.content}
                </div>
              ) : null}
            </div>
          ) : null}

          {footer ? <div className="pt-3">{footer}</div> : null}
        </div>
      </div>
    </output>
  );
}
