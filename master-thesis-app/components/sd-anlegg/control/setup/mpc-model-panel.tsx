"use client";

import type {
  MpcEvalCoverageSummary,
  MpcPipelineRunRecord,
} from "@/lib/sd-anlegg/control/control-types";
import { MPC_CONTROL_MODEL_VERSION } from "@/lib/sd-anlegg/control/control-constants";
import { CONTROL_DISPLAY } from "@/lib/sd-anlegg/control/control-display-labels";
import { DEFAULT_MPC_BOUNDS } from "@/lib/sd-anlegg/mpc/config/mpc-config";
import { assessPlantPredictionBounded } from "@/lib/sd-anlegg/mpc/pipeline/assess-plant-prediction-error";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";
import { MPC_CONTROL_KEYS } from "@/lib/sd-anlegg/mpc/shared/types";
import { SdAnleggControlClaimBadge } from "@/components/sd-anlegg/control/shared/claim-badge";
import {
  SD_ANLEGG_CARD,
  SD_ANLEGG_INFO_BANNER,
  SD_ANLEGG_KPI_VALUE,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  coverage: MpcEvalCoverageSummary | null;
  mpcPipelineRun: MpcPipelineRunRecord | null;
  compact?: boolean;
};

const CONTROL_LABELS: Record<keyof MpcControlVector, string> = {
  supplySetpointC: "Tilluft SP (°C)",
  supplyFanPct: "Tilluftvifte (%)",
  exhaustFanPct: "Avtrekkvifte (%)",
  heatingValvePct: "Varmeventil (%)",
  coolingValvePct: "Kjøleventil (%)",
  districtTr002ValvePct: "TR002 ventil (%)",
  districtTr003ValvePct: "TR003 ventil (%)",
};

const CANONICAL_LABELS: Record<string, string> = {
  "supply.setpoint": "Tilluft settpunkt (målt)",
  "supply.setpoint_calculated": "Tilluft settpunkt (MPC)",
  "supply.fan.command": "Tilluftvifte pådrag",
  "exhaust.fan.command": "Avtrekkvifte pådrag",
  "heating.valve.command": "Varmeventil pådrag",
  "cooling.valve.command": "Kjøleventil pådrag",
  "supply.temp": "Tilluft temperatur (SD)",
  "extract.temp": "Avtrekkstemperatur (komfortproxy)",
};

function formatPct(value: number): string {
  return `${Math.round(value * 100)} %`;
}

function CoverageBar({ pct, ok }: { pct: number; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200 ease-out",
            ok ? "bg-primary" : "bg-amber-500",
          )}
          style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right tabular-nums text-[11px] text-muted-foreground">
        {formatPct(pct)}
      </span>
    </div>
  );
}

export function SdAnleggControlMpcModelPanel({
  coverage,
  mpcPipelineRun,
  compact = false,
}: Props) {
  const calibration = mpcPipelineRun?.calibration;
  const bounds = calibration?.solver.bounds ?? DEFAULT_MPC_BOUNDS;
  const solver = calibration?.solver;

  const plantValidation = mpcPipelineRun?.snapshot.plantValidation;
  const comfortBand = solver?.comfortBandC ?? { min: 18, max: 24 };
  const plantBounded = assessPlantPredictionBounded({
    rmseC: plantValidation?.rmseC,
    comfortBandC: comfortBand,
  });
  const plantFeatureScope =
    plantValidation?.featureScope ?? calibration?.plant.featureScope ?? [];
  const plantMultiStep = plantValidation?.multiStep ?? [];
  const usedFeatureCount = plantFeatureScope.filter((f) => f.usedInModel).length;

  const modelChainCard = (
    <Card className={SD_ANLEGG_CARD}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-sm font-semibold">Modellkvalitet</CardTitle>
          <SdAnleggControlClaimBadge kind="simulated" />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 pt-0 sm:grid-cols-3">
        {[
          {
            title: `1 · ${CONTROL_DISPLAY.predicted.short}`,
            body: "Historikk og vær gir forventet pådrag når måling mangler.",
            metric: calibration
              ? `MAE SP ${mpcPipelineRun?.snapshot.emulatorValidation.mae.supplySetpointC?.toFixed(2) ?? "—"} °C`
              : "Kalibreres ved første kjøring",
          },
          {
            title: "2 · Kuvertmodell",
            body:
              calibration?.plant.version === "plant-v2"
                ? "To koblede temperaturtilstander med pådrag og utetemp."
                : "Lineær avtrekkmodell med SD-observasjoner der dekning er tilstrekkelig.",
            metric: calibration
              ? `RMSE ${plantValidation?.rmseC ?? "—"} °C · ${usedFeatureCount} signaler`
              : "Krever avtrekkstemp ≥ 50 %",
          },
          {
            title: "3 · Optimalisering",
            body: "Minimerer estimert kost, endring i pådrag og komfortbrudd over horisonten.",
            metric: mpcPipelineRun?.snapshot.replaySummary
              ? `${mpcPipelineRun.snapshot.replaySummary.optimizedSteps ?? "—"}/${mpcPipelineRun.snapshot.replaySummary.stepCount} intervaller`
              : "Venter på data",
          },
        ].map((block) => (
          <div
            key={block.title}
            className="rounded-md border border-border/60 bg-muted/20 px-3 py-2"
          >
            <p className="text-xs font-medium">{block.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {block.body}
            </p>
            <p className={cn(SD_ANLEGG_KPI_VALUE, "mt-2 text-sm")}>
              {block.metric}
            </p>
          </div>
        ))}
      </CardContent>
      {solver ? (
        <CardContent className="border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          Horisont {solver.horizonSteps}×15 min · komfort{" "}
          {solver.comfortBandC.min}–{solver.comfortBandC.max} °C · trening{" "}
          {calibration?.trainStepCount} / holdout {calibration?.holdoutStepCount}{" "}
          intervaller
        </CardContent>
      ) : null}
    </Card>
  );

  const envelopeDetailCard =
    plantFeatureScope.length > 0 || plantMultiStep.length > 0 ? (
      <Card className={SD_ANLEGG_CARD}>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-sm font-semibold">Kuvertmodell — validering</CardTitle>
            {plantBounded ? (
              <Badge
                variant={plantBounded.bounded ? "secondary" : "outline"}
                className={cn(
                  "text-[10px]",
                  !plantBounded.bounded && "border-amber-500 text-amber-700 dark:text-amber-400",
                )}
              >
                {plantBounded.bounded
                  ? `Prediksjonsfeil ≤ ${Math.round(plantBounded.rmseShareOfBand * 100)} % av komfortband`
                  : `Høy prediksjonsfeil (${Math.round(plantBounded.rmseShareOfBand * 100)} % av band)`}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0 text-xs">
          {plantFeatureScope.length > 0 ? (
            <div>
              <p className="mb-2 text-muted-foreground">
                Features velges betinget av SD-dekning (≥ 90 %). Grå = tilgjengelig
                men utelatt; rød = mangler i caset.
              </p>
              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40">
                      <th className="px-2 py-1.5 font-medium">Signal</th>
                      <th className="px-2 py-1.5 font-medium text-right">Dekning</th>
                      <th className="px-2 py-1.5 font-medium text-right">I modell</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plantFeatureScope.map((feature) => (
                      <tr
                        key={feature.featureId}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="px-2 py-1.5">{feature.label}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                          {feature.coveragePct != null
                            ? `${feature.coveragePct} %`
                            : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <Badge
                            variant={
                              feature.usedInModel
                                ? "default"
                                : feature.availability === "missing"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {feature.usedInModel
                              ? "Ja"
                              : feature.availability === "missing"
                                ? "Mangler"
                                : "Nei"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {plantValidation?.heatRecoveryState ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <div>
                <p className="text-xs font-medium">Andre tilstand — varmegjenvinner etter-temp</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {plantValidation.heatRecoveryState.comparedSteps} sammenlignede steg
                </p>
              </div>
              <p className={cn(SD_ANLEGG_KPI_VALUE, "text-sm")}>
                RMSE {plantValidation.heatRecoveryState.rmseC} °C
              </p>
            </div>
          ) : null}

          {plantMultiStep.length > 0 ? (
            <div>
              <p className="mb-2 text-muted-foreground">
                Multi-steg (åpen løkke): prediksjonsfeil når tilstand rulleres uten
                målings-blend.
              </p>
              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40">
                      <th className="px-2 py-1.5 font-medium">Horisont</th>
                      <th className="px-2 py-1.5 font-medium text-right">MAE</th>
                      <th className="px-2 py-1.5 font-medium text-right">RMSE</th>
                      <th className="px-2 py-1.5 font-medium text-right">Starter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plantMultiStep.map((row) => (
                      <tr
                        key={row.horizonHours}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="px-2 py-1.5">{row.horizonHours} t</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {row.maeC} °C
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {row.rmseC} °C
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                          {row.comparedStarts}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    ) : null;

  if (compact) {
    if (!mpcPipelineRun?.snapshot) return null;
    return (
      <div className="space-y-4">
        {modelChainCard}
        {envelopeDetailCard}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className={cn(SD_ANLEGG_INFO_BANNER, "text-xs leading-relaxed")}>
        MPC ({MPC_CONTROL_MODEL_VERSION}) estimerer counterfactual pådrag{" "}
        <strong>u<sub>MPC</sub></strong> mot observert BMS{" "}
        <strong>u<sub>meas</sub></strong> og {CONTROL_DISPLAY.predicted.short.toLowerCase()}{" "}
        <strong>u<sub>BMS,sim</sub></strong>. Influx gir maks ~
        {coverage?.influxLookbackHours ?? 48} t historikk; eldre eval-steg leses
        fra Postgres (kontinuerlig sync).
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={SD_ANLEGG_CARD}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">
                Data fra Infraspawn (SD)
              </CardTitle>
              {coverage ? (
                <Badge
                  variant={coverage.canSimulate ? "default" : "destructive"}
                  className="text-[10px]"
                >
                  {coverage.canSimulate ? "Klar for sim" : "Blokkert"}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-xs">
            {!coverage ? (
              <p className="text-muted-foreground">
                Dekningsrapport utilgjengelig — sjekk bygg/kilde og THESIS_EVAL_*.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between gap-2 text-muted-foreground">
                    <span>uMeas (SP + vifte + varme)</span>
                    <span className="tabular-nums">
                      {coverage.stepsWithUMeas}/{coverage.stepCount} steg
                    </span>
                  </div>
                  <CoverageBar
                    pct={coverage.uMeasPct}
                    ok={coverage.uMeasPct >= coverage.thresholdPct}
                  />
                  <div className="flex justify-between gap-2 text-muted-foreground">
                    <span>extract.temp (plant)</span>
                  </div>
                  <CoverageBar
                    pct={coverage.extractTempPct}
                    ok={coverage.extractTempPct >= 0.5}
                  />
                </div>

                {coverage.signals.length > 0 ? (
                  <div className="overflow-x-auto rounded-md border border-border/60">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-border/60 bg-muted/40">
                          <th className="px-2 py-1.5 font-medium">Signal</th>
                          <th className="px-2 py-1.5 font-medium text-right">
                            Dekning
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {coverage.signals.map((s) => (
                          <tr
                            key={s.canonicalId}
                            className="border-b border-border/40 last:border-0"
                          >
                            <td className="px-2 py-1.5">
                              {CANONICAL_LABELS[s.canonicalId] ?? s.canonicalId}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {formatPct(s.coveragePct)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {coverage.blockReason ? (
                  <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-destructive">
                    {coverage.blockReason}
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className={SD_ANLEGG_CARD}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Kontrollvektor u og grenser
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-xs">
            <p className="text-muted-foreground">
              Optimeringsvariabler per 15-min steg. Grenser fra kalibrert run
              {calibration ? "" : " (standard defaults)"}.
            </p>
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40">
                    <th className="px-2 py-1.5 font-medium">Signal</th>
                    <th className="px-2 py-1.5 font-medium text-right">Min</th>
                    <th className="px-2 py-1.5 font-medium text-right">Max</th>
                    <th className="px-2 py-1.5 font-medium text-right">
                      Δ/steg
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MPC_CONTROL_KEYS.map((key) => (
                    <tr
                      key={key}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td className="px-2 py-1.5">{CONTROL_LABELS[key]}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {bounds.min[key]}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {bounds.max[key]}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        ±{bounds.maxDeltaPerStep[key]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {solver ? (
              <p className="text-muted-foreground">
                Horisont {solver.horizonSteps}×15 min · comfort{" "}
                {solver.comfortBandC.min}–{solver.comfortBandC.max} °C · train{" "}
                {calibration?.trainStepCount} / holdout{" "}
                {calibration?.holdoutStepCount} steg
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {modelChainCard}
      {envelopeDetailCard}
    </div>
  );
}
