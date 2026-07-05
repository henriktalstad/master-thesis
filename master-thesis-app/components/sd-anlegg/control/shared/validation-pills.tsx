"use client";

import { CheckCircle2, AlertTriangle, CircleDashed } from "lucide-react";
import type { MpcPipelineRunRecord } from "@/lib/sd-anlegg/control/control-types";
import { formatFallbackPctDisplay, normalizeFallbackPctFraction } from "@/lib/sd-anlegg/control/normalize-fallback-pct";
import { cn } from "@/lib/utils";

type Pill = {
  id: string;
  label: string;
  tone: "ok" | "warn" | "neutral";
};

function buildPills(run: MpcPipelineRunRecord | null): Pill[] {
  const replay = run?.snapshot?.replaySummary;
  if (!replay) {
    return [{ id: "pending", label: "Venter på simulering", tone: "neutral" }];
  }

  const fallbackPctDisplay = formatFallbackPctDisplay(replay.fallbackPct ?? 0);
  const fallbackPctFraction = normalizeFallbackPctFraction(replay.fallbackPct ?? 0);
  const fallbackPctPercent = fallbackPctFraction * 100;
  const pills: Pill[] = [
    {
      id: "steps",
      label: `${replay.stepCount} intervaller`,
      tone: "ok",
    },
  ];

  pills.push({
    id: "fallback",
    label:
      fallbackPctFraction <= 0
        ? "Optimalisert overalt"
        : `${fallbackPctDisplay} uten optimalisering`,
    tone: fallbackPctPercent < 5 ? "ok" : "warn",
  });

  return pills;
}

const TONE_STYLES = {
  ok: "border-emerald-500/30 bg-emerald-500/8 text-emerald-800 dark:text-emerald-300",
  warn: "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  neutral: "border-border/80 bg-muted/30 text-muted-foreground",
} as const;

type Props = {
  mpcPipelineRun: MpcPipelineRunRecord | null;
  className?: string;
};

export function SdAnleggControlValidationPills({
  mpcPipelineRun,
  className,
}: Props) {
  const pills = buildPills(mpcPipelineRun);

  return (
    <ul
      className={cn("flex flex-wrap gap-1.5", className)}
      aria-label="Simuleringsstatus"
    >
      {pills.map((pill) => (
        <li
          key={pill.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-snug",
            TONE_STYLES[pill.tone],
          )}
        >
          {pill.tone === "ok" ? (
            <CheckCircle2 className="size-3 shrink-0 opacity-80" aria-hidden />
          ) : pill.tone === "warn" ? (
            <AlertTriangle className="size-3 shrink-0 opacity-80" aria-hidden />
          ) : (
            <CircleDashed className="size-3 shrink-0 opacity-70" aria-hidden />
          )}
          {pill.label}
        </li>
      ))}
    </ul>
  );
}
