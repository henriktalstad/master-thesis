"use client";

import type { ReplaySignalSummary } from "@/lib/sd-anlegg/control/summarize-replay-signals";
import {
  formatControlDateTimeLabel,
  formatControlSignalValue,
} from "@/lib/sd-anlegg/control/chart-utils";
import { SD_ANLEGG_CARD, SD_ANLEGG_INFO_BANNER } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  summary: ReplaySignalSummary;
  liveSummary?: ReplaySignalSummary | null;
  embedded?: boolean;
  className?: string;
};

function SignalCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
      ) : null}
    </div>
  );
}

function StepBlock({
  title,
  step,
  subtitle,
}: {
  title: string;
  step: ReplaySignalSummary["latestStep"];
  subtitle?: string;
}) {
  if (!step) return null;
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium text-foreground">{title}</p>
        {subtitle ? (
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <SignalCell
          label="Foroverkobling · utetemp"
          value={formatControlSignalValue(step.outdoorTempC, "°C")}
        />
        {step.outdoorTempBmsC != null ? (
          <SignalCell
            label="Foroverkobling · utetemp BMS"
            value={formatControlSignalValue(step.outdoorTempBmsC, "°C")}
          />
        ) : null}
        <SignalCell
          label="Foroverkobling · pris"
          value={formatControlSignalValue(step.marginalKrPerKwh, "kr/kWh")}
        />
        <SignalCell
          label="Målt pådrag"
          value={step.hasUMeas ? "OK" : "Mangler"}
        />
        <SignalCell
          label="Tilbakekobling · avtrekk målt"
          value={formatControlSignalValue(step.extractTempMeasC, "°C")}
          sub="Komfortproxy y_k"
        />
        <SignalCell
          label="Tilbakekobling · tilluft målt"
          value={formatControlSignalValue(step.supplyTempMeasC, "°C")}
          sub={
            step.supplySetpointC != null
              ? `SP ${formatControlSignalValue(step.supplySetpointC, "°C")}`
              : "Observasjon — ikke y_k"
          }
        />
        <SignalCell
          label="Plantpred. avtrekk"
          value={formatControlSignalValue(step.extractTempPredC, "°C")}
        />
        <SignalCell
          label="Optimalisering"
          value={step.usedFallback ? "Av" : "På"}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {formatControlDateTimeLabel(step.t)} (Europe/Oslo)
      </p>
    </div>
  );
}

export function SdAnleggControlReplaySignalsPanel({
  summary,
  liveSummary = null,
  embedded = false,
  className,
}: Props) {
  const ff = summary.feedforward;
  const fb = summary.feedback;
  const liveStep = liveSummary?.latestStep ?? null;
  const showLiveStep =
    liveStep != null &&
    liveStep.t !== summary.latestStep?.t;

  return (
    <section
      aria-label="Foroverkobling og tilbakekobling"
      className={cn(
        embedded ? undefined : SD_ANLEGG_CARD,
        embedded ? undefined : "px-4 py-4 sm:px-5",
        className,
      )}
    >
      {!embedded ? (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground">
            Prediksjon — foroverkobling og data
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {summary.stepCount} perioder à 15 min — vær og pris som styrer beregningen.
          </p>
        </div>
      ) : null}

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <SignalCell
          label="Værdekning (Frost → BMS)"
          value={`${ff.stepsWithOutdoorTemp}/${summary.stepCount}`}
          sub={[
            ff.outdoorTempMeanC != null
              ? `Snitt ${formatControlSignalValue(ff.outdoorTempMeanC, "°C")}`
              : null,
            ff.stepsWithOutdoorTempBms > 0
              ? `BMS ${ff.stepsWithOutdoorTempBms}/${summary.stepCount}${
                  ff.outdoorTempBmsMeanC != null
                    ? ` · snitt ${formatControlSignalValue(ff.outdoorTempBmsMeanC, "°C")}`
                    : ""
                }`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <SignalCell
          label="Prisdekning"
          value={`${ff.stepsWithPrice}/${summary.stepCount}`}
          sub={
            ff.priceMeanKrPerKwh != null
              ? `Snitt ${formatControlSignalValue(ff.priceMeanKrPerKwh, "kr/kWh")}`
              : undefined
          }
        />
        <SignalCell
          label="Dekning målt pådrag"
          value={`${fb.uMeasCoveragePct} %`}
          sub={`${fb.stepsWithUMeas} perioder`}
        />
        <SignalCell
          label="Avtrekk målt"
          value={`${fb.stepsWithExtractMeas}/${summary.stepCount}`}
          sub={
            fb.extractMeasMeanC != null
              ? `Snitt ${formatControlSignalValue(fb.extractMeasMeanC, "°C")} · komfortproxy`
              : undefined
          }
        />
        <SignalCell
          label="Tilluft SP-sporing"
          value={
            summary.supplyTracking.maeSetpointTrackingC != null
              ? `MAE ${formatControlSignalValue(summary.supplyTracking.maeSetpointTrackingC, "°C")}`
              : "—"
          }
          sub={
            summary.supplyTracking.comparedSteps > 0
              ? `${summary.supplyTracking.comparedSteps} perioder · lokal loop`
              : "Mangler målt tilluft eller SP"
          }
        />
      </div>

      {ff.stepsWithOutdoorTemp === 0 && ff.stepsWithPrice === 0 ? (
        <p
          className={cn(
            SD_ANLEGG_INFO_BANNER,
            "mb-4 text-xs leading-relaxed text-amber-900 dark:text-amber-100",
          )}
        >
          Mangler vær eller pris i perioden — sjekk at SD-data og spotpris er synket.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <StepBlock
          title="Siste periode"
          subtitle="Nyeste beregnet steg"
          step={summary.latestStep}
        />
        <StepBlock
          title="Midt i perioden"
          subtitle="Typisk steg i evalueringsvinduet"
          step={summary.midStep}
        />
      </div>

      {showLiveStep ? (
        <div className="mt-4 border-t border-border/60 pt-4">
          <StepBlock
            title="Siste live-oppdatering"
            subtitle="Kan avvike fra historisk beregning"
            step={liveStep}
          />
        </div>
      ) : null}
    </section>
  );
}
