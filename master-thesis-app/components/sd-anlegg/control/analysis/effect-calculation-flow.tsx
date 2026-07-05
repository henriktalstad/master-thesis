"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { EffectFlowSnapshot } from "@/lib/sd-anlegg/control/build-effect-flow-snapshot";
import {
  CONTROL_COMFORT_EXTRACT,
  CONTROL_EFFECT_STRATEGY_LINES,
  CONTROL_EFFECT_UI,
} from "@/lib/sd-anlegg/control/control-display-labels";
import { formatProxyKr } from "@/components/sd-anlegg/control/format-proxy-kr";
import { SD_ANLEGG_BTN_PRESS, SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  snapshot: EffectFlowSnapshot;
  className?: string;
  defaultOpen?: boolean;
};

const TRACK_ACCENT: Record<
  EffectFlowSnapshot["tracks"][number]["id"],
  { border: string; bar: string; dot: string }
> = {
  observed: {
    border: "border-l-emerald-500/70",
    bar: "bg-emerald-500/65",
    dot: "bg-emerald-500",
  },
  emulated: {
    border: "border-l-sky-500/70",
    bar: "bg-sky-500/65",
    dot: "bg-sky-500",
  },
  demand: {
    border: "border-l-amber-500/70",
    bar: "bg-amber-500/65",
    dot: "bg-amber-500",
  },
  mpc: {
    border: "border-l-violet-500/70",
    bar: "bg-violet-500/65",
    dot: "bg-violet-500",
  },
};

const INPUT_LABELS = [
  CONTROL_EFFECT_UI.methodologyInputSd,
  CONTROL_EFFECT_UI.methodologyInputWeather,
  CONTROL_EFFECT_UI.methodologyInputPrice,
  CONTROL_EFFECT_UI.methodologyInputBhcc,
] as const;

function formatPct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toLocaleString("nb-NO", { maximumFractionDigits: 1 })} %`;
}

function StepBlock({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="relative pl-8">
      <span
        className="absolute left-0 top-0 flex size-5 items-center justify-center rounded-full border border-border/80 bg-background text-[10px] font-semibold tabular-nums text-muted-foreground"
        aria-hidden
      >
        {step}
      </span>
      <p className="mb-2 text-xs font-medium text-foreground">{title}</p>
      {children}
    </div>
  );
}

function HeroLinkRow({
  label,
  kr,
  pct,
}: {
  label: string;
  kr: number;
  pct: number;
}) {
  const improved = kr < 0;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-border/50 py-2 first:border-t-0 first:pt-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          improved
            ? "text-emerald-600 dark:text-emerald-400"
            : kr > 0
              ? "text-amber-700 dark:text-amber-300"
              : "text-foreground",
        )}
      >
        {formatProxyKr(kr)}{" "}
        <span className="text-xs font-normal text-muted-foreground">
          ({formatPct(pct)})
        </span>
      </p>
    </div>
  );
}

export function SdAnleggControlEffectCalculationFlow({
  snapshot,
  className,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [technicalOpen, setTechnicalOpen] = useState(false);

  const observed = snapshot.tracks.find((t) => t.id === "observed");
  const emulated = snapshot.tracks.find((t) => t.id === "emulated");
  const mpc = snapshot.tracks.find((t) => t.id === "mpc");
  const maxCost = Math.max(...snapshot.tracks.map((t) => t.totalCostKr), 1);

  return (
    <section
      aria-label="Hvordan effekten beregnes"
      className={cn(SD_ANLEGG_CARD, "overflow-hidden", className)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left sm:px-5",
          SD_ANLEGG_BTN_PRESS,
        )}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {CONTROL_EFFECT_UI.methodologyTitle}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {CONTROL_EFFECT_UI.methodologyDescription}
          </p>
          <p className="mt-1 text-[11px] tabular-nums text-muted-foreground/90">
            {snapshot.stepCount.toLocaleString("nb-NO")} intervaller à 15 min
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="space-y-5 border-t border-border/50 px-4 pb-4 pt-4 sm:px-5">
          <StepBlock step={1} title={CONTROL_EFFECT_UI.methodologyStepInputsTitle}>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {INPUT_LABELS.join(" · ")}
            </p>
          </StepBlock>

          <StepBlock step={2} title={CONTROL_EFFECT_UI.methodologyStepTracksTitle}>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {snapshot.tracks.map((track) => {
                const accent = TRACK_ACCENT[track.id];
                return (
                  <div
                    key={track.id}
                    className={cn(
                      "rounded-md border border-border/60 border-l-[3px] bg-background/80 px-3 py-2.5",
                      accent.border,
                      track.id === "mpc" && "bg-violet-500/3",
                    )}
                  >
                    <p className="text-xs font-medium text-foreground">{track.label}</p>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      {track.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </StepBlock>

          <StepBlock step={3} title={CONTROL_EFFECT_UI.methodologyStepComputeTitle}>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {CONTROL_EFFECT_UI.methodologyComputeShort}
            </p>
          </StepBlock>

          <StepBlock step={4} title={CONTROL_EFFECT_UI.methodologyStepSumTitle}>
            <div className="space-y-2.5">
              {snapshot.tracks.map((track) => {
                const accent = TRACK_ACCENT[track.id];
                const widthPct = Math.max(6, (track.totalCostKr / maxCost) * 100);
                return (
                  <div key={track.id} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn("size-1.5 shrink-0 rounded-full", accent.dot)}
                          aria-hidden
                        />
                        <p className="truncate text-xs font-medium text-foreground">
                          {track.label}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatProxyKr(track.totalCostKr)}
                      </p>
                    </div>
                    <div
                      className="h-1 overflow-hidden rounded-full bg-muted/50"
                      aria-hidden
                    >
                      <div
                        className={cn(
                          "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out",
                          accent.bar,
                        )}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      {track.totalEnergyKwh.toLocaleString("nb-NO")}{" "}
                      {CONTROL_EFFECT_UI.methodologyEnergySuffix}
                    </p>
                  </div>
                );
              })}
            </div>

            {mpc && observed && emulated ? (
              <div className="mt-4 rounded-md border border-border/60 bg-muted/10 px-3 py-1">
                <HeroLinkRow
                  label={CONTROL_EFFECT_UI.methodologyHeroObserved}
                  kr={snapshot.heroDeltaObservedKr}
                  pct={snapshot.heroDeltaObservedPct}
                />
                {snapshot.heroDeltaEmulatedKr != null &&
                snapshot.heroDeltaEmulatedPct != null ? (
                  <HeroLinkRow
                    label={CONTROL_EFFECT_UI.methodologyHeroEmulated}
                    kr={snapshot.heroDeltaEmulatedKr}
                    pct={snapshot.heroDeltaEmulatedPct}
                  />
                ) : null}
              </div>
            ) : null}

            {snapshot.measuredBuildingCostKr != null &&
            snapshot.proxyObservedCostKr != null ? (
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {CONTROL_EFFECT_UI.methodologyScopeFootnote(
                  snapshot.proxyObservedCostKr,
                  snapshot.measuredBuildingCostKr,
                  snapshot.ventilationElSharePct,
                )}
              </p>
            ) : null}
          </StepBlock>

          <div>
            <button
              type="button"
              onClick={() => setTechnicalOpen((v) => !v)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-left text-xs text-muted-foreground motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/20 [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground",
                SD_ANLEGG_BTN_PRESS,
              )}
              aria-expanded={technicalOpen}
            >
              {CONTROL_EFFECT_UI.methodologyTechnicalToggle}
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out",
                  technicalOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>

            {technicalOpen ? (
              <div className="mt-2 space-y-3 rounded-md border border-dashed border-border/70 bg-muted/5 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
                <div>
                  <p className="mb-1 font-medium text-foreground">
                    {CONTROL_EFFECT_UI.methodologyTechnicalFormulaLabel}
                  </p>
                  <p className="font-mono text-[11px]">{CONTROL_EFFECT_UI.methodologyTechnicalFormula}</p>
                </div>
                <p>{CONTROL_EFFECT_UI.methodologyTechnicalEl}</p>
                <p>{CONTROL_EFFECT_UI.methodologyTechnicalHeat}</p>
                <p>
                  <span className="font-medium text-foreground">
                    {CONTROL_COMFORT_EXTRACT.columnFull}:
                  </span>{" "}
                  {CONTROL_COMFORT_EXTRACT.modelNote} Observert spor bruker målt avtrekk
                  fra SD som referanse.
                </p>
                <ul className="space-y-2 border-t border-border/50 pt-3">
                  {CONTROL_EFFECT_STRATEGY_LINES.map((strategy) => (
                    <li key={strategy.label}>
                      <span className="font-medium text-foreground">{strategy.label}:</span>{" "}
                      {strategy.line} {strategy.comfortLine}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
