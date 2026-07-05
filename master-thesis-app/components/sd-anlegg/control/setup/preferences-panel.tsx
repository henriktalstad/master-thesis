"use client";

import { useMemo, useState, useTransition } from "react";
import {
  saveMpcBuildingPreferencesAction,
  simulateMpcWithPreferencesAction,
  type SimulateMpcPreferencesResult,
} from "@/actions/mpc-preferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  MpcBuildingPreferencesOverrides,
  MpcPreferenceCondition,
  ResolvedMpcBuildingPreferences,
} from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";
import {
  MPC_PREFERENCE_CONDITION_LABELS,
  MPC_PREFERENCE_ROLE_LABELS,
} from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";
import { MPC_TUNING_PRESETS, presetById } from "@/lib/sd-anlegg/mpc/config/mpc-tuning-presets";
import type { MpcTuningPresetId } from "@/lib/sd-anlegg/mpc/config/mpc-tuning-presets";
import { cn } from "@/lib/utils";
import { SdAnleggControlCollapsibleSection } from "@/components/sd-anlegg/control/shared/section";
import { SD_ANLEGG_BTN_PRESS, SD_ANLEGG_CARD, SD_ANLEGG_INFO_BANNER } from "@/components/sd-anlegg/sd-anlegg-ui";
import { CONTROL_EXAMINER_MODE, CONTROL_SETUP_UI } from "@/lib/sd-anlegg/control/control-display-labels";

type Props = {
  buildingSlug: string;
  preferences: ResolvedMpcBuildingPreferences;
  hasSavedOverrides: boolean;
  canSimulate: boolean;
  examinerMode?: boolean;
};

function formatObserved(value: number | null, unit: string): string {
  if (value == null) return "—";
  return unit === "°C" ? `${value.toFixed(1)} °C` : `${Math.round(value)} %`;
}

function overridesFromPreferences(
  prefs: ResolvedMpcBuildingPreferences,
): MpcBuildingPreferencesOverrides {
  const channels: MpcBuildingPreferencesOverrides["channels"] = {};
  for (const ch of prefs.channels) {
    channels[ch.id] = {
      enabledForMpc: ch.enabledForMpc,
      condition: ch.condition,
      limits: { ...ch.effectiveLimits },
    };
  }
  return {
    comfortBandMinC: prefs.comfortBandC.min,
    comfortBandMaxC: prefs.comfortBandC.max,
    tuningPresetId: prefs.tuningPresetId,
    stateBlendAlpha: prefs.stateBlendAlpha,
    channels,
  };
}

export function SdAnleggControlPreferencesPanel({
  buildingSlug,
  preferences,
  hasSavedOverrides,
  canSimulate,
  examinerMode = false,
}: Props) {
  const readOnly = examinerMode;
  const [draft, setDraft] = useState(() => overridesFromPreferences(preferences));
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<SimulateMpcPreferencesResult | null>(
    null,
  );

  const channelRows = useMemo(
    () =>
      preferences.channels.map((ch) => {
        const ov = draft.channels?.[ch.id];
        return { def: ch, ov };
      }),
    [preferences.channels, draft.channels],
  );

  const activePreset = useMemo(() => {
    const id = (draft.tuningPresetId ?? preferences.tuningPresetId) as MpcTuningPresetId;
    return presetById(id);
  }, [draft.tuningPresetId, preferences.tuningPresetId]);

  function updateChannel(
    id: (typeof preferences.channels)[number]["id"],
    patch: NonNullable<MpcBuildingPreferencesOverrides["channels"]>[typeof id],
  ) {
    setDraft((prev) => ({
      ...prev,
      channels: {
        ...prev.channels,
        [id]: { ...prev.channels?.[id], ...patch },
      },
    }));
  }

  function updateLimit(
    id: (typeof preferences.channels)[number]["id"],
    field: "min" | "max" | "maxDeltaPerStep",
    raw: string,
  ) {
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    updateChannel(id, {
      limits: {
        ...draft.channels?.[id]?.limits,
        [field]: num,
      },
    });
  }

  function runSave() {
    setStatus(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveMpcBuildingPreferencesAction({
          buildingSlug,
          overrides: draft,
        });
        setStatus(`Lagret ${result.updatedAt.slice(0, 16).replace("T", " ")} UTC`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke lagre");
      }
    });
  }

  function runSimulate() {
    setStatus(null);
    setError(null);
    setSimResult(null);
    startTransition(async () => {
      try {
        const result = await simulateMpcWithPreferencesAction({
          buildingSlug,
          overrides: draft,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        if (result.queued) {
          setSimResult(null);
          setStatus(result.message);
          return;
        }
        setSimResult(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Simulering feilet");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className={cn(SD_ANLEGG_INFO_BANNER, "text-sm leading-relaxed")}>
        <p>{CONTROL_SETUP_UI.preferencesIntro}</p>
        {readOnly ? (
          <p className="mt-2 text-xs text-muted-foreground">{CONTROL_EXAMINER_MODE.setupReadOnly}</p>
        ) : hasSavedOverrides ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {CONTROL_SETUP_UI.preferencesSavedNote}
          </p>
        ) : null}
      </div>

      <Card className={SD_ANLEGG_CARD}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Globalt</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="comfort-min">Avtrekk min</Label>
            <Input
              id="comfort-min"
              type="number"
              step={0.5}
              disabled={readOnly}
              value={draft.comfortBandMinC ?? preferences.comfortBandC.min}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  comfortBandMinC: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comfort-max">Avtrekk max</Label>
            <Input
              id="comfort-max"
              type="number"
              step={0.5}
              disabled={readOnly}
              value={draft.comfortBandMaxC ?? preferences.comfortBandC.max}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  comfortBandMaxC: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state-blend">{CONTROL_SETUP_UI.stateBlendLabel}</Label>
            <Input
              id="state-blend"
              type="number"
              min={0}
              max={1}
              step={0.05}
              disabled={readOnly}
              value={draft.stateBlendAlpha ?? preferences.stateBlendAlpha}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  stateBlendAlpha: Number(e.target.value),
                }))
              }
            />
            <p className="text-[11px] text-muted-foreground">
              {CONTROL_SETUP_UI.stateBlendHint}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Optimaliseringsprofil</Label>
            <Select
              value={draft.tuningPresetId ?? preferences.tuningPresetId}
              disabled={readOnly}
              onValueChange={(v) =>
                setDraft((p) => ({ ...p, tuningPresetId: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MPC_TUNING_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {activePreset.description}
            </p>
          </div>
        </CardContent>
      </Card>

      <SdAnleggControlCollapsibleSection
        title={CONTROL_SETUP_UI.solverParamsTitle}
        description={`λ_move=${activePreset.solver.lambdaMove} · λ_comfort=${activePreset.solver.lambdaComfort} · ${activePreset.solver.maxIterations} iter`}
      >
        <p className="px-4 pb-4 text-[11px] text-muted-foreground">
          {CONTROL_SETUP_UI.solverParamsDescription}
        </p>
      </SdAnleggControlCollapsibleSection>

      <Card className={SD_ANLEGG_CARD}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Settpunkter</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Signal</th>
                <th className="pb-2 pr-3 font-medium">Rolle</th>
                <th className="pb-2 pr-3 font-medium">Observert</th>
                <th className="pb-2 pr-3 font-medium">{CONTROL_SETUP_UI.channelSimulatedColumn}</th>
                <th className="pb-2 pr-3 font-medium">Betingelse</th>
                <th className="pb-2 pr-3 font-medium">Min</th>
                <th className="pb-2 pr-3 font-medium">Max</th>
                <th className="pb-2 font-medium">Maks endring/steg</th>
              </tr>
            </thead>
            <tbody>
              {channelRows.map(({ def, ov }) => {
                const isLocal = !def.mpcOptimizable;
                const enabled = isLocal ? false : (ov?.enabledForMpc ?? true);
                const condition = ov?.condition ?? def.condition;
                const limits = ov?.limits ?? def.effectiveLimits;
                return (
                  <tr
                    key={def.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-2.5 pr-3 font-medium">{def.label}</td>
                    <td className="py-2.5 pr-3">
                      <Badge variant="outline" className="font-normal">
                        {MPC_PREFERENCE_ROLE_LABELS[def.role]}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                      {formatObserved(def.observedValue, def.unit)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={isLocal || readOnly}
                        aria-label={`Simulert for ${def.label}`}
                        className="size-4 rounded border-border accent-primary disabled:opacity-40"
                        onChange={(e) =>
                          updateChannel(def.id, {
                            enabledForMpc: e.target.checked,
                          })
                        }
                      />
                    </td>
                    <td className="py-2.5 pr-3">
                      <Select
                        value={condition}
                        disabled={isLocal || readOnly}
                        onValueChange={(v) =>
                          updateChannel(def.id, {
                            condition: v as MpcPreferenceCondition,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 min-w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(MPC_PREFERENCE_CONDITION_LABELS).map(
                            ([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Input
                        type="number"
                        className="h-8 w-20"
                        disabled={isLocal || readOnly}
                        value={limits.min}
                        onChange={(e) =>
                          updateLimit(def.id, "min", e.target.value)
                        }
                      />
                    </td>
                    <td className="py-2.5 pr-3">
                      <Input
                        type="number"
                        className="h-8 w-20"
                        disabled={isLocal || readOnly}
                        value={limits.max}
                        onChange={(e) =>
                          updateLimit(def.id, "max", e.target.value)
                        }
                      />
                    </td>
                    <td className="py-2.5">
                      <Input
                        type="number"
                        className="h-8 w-20"
                        disabled={isLocal || readOnly}
                        value={limits.maxDeltaPerStep}
                        onChange={(e) =>
                          updateLimit(def.id, "maxDeltaPerStep", e.target.value)
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {!readOnly ? (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={runSave}
          className={cn(SD_ANLEGG_BTN_PRESS, "transition-transform duration-150 ease-out")}
        >
          {pending ? "Lagrer …" : "Lagre preferanser"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending || !canSimulate}
          title={!canSimulate ? "Trenger tilstrekkelig SD-dekning" : undefined}
          onClick={runSimulate}
          className={cn(SD_ANLEGG_BTN_PRESS, "transition-transform duration-150 ease-out")}
        >
          {pending ? "Simulerer …" : "Simuler og lagre"}
        </Button>
      </div>
      ) : null}

      {status ? (
        <p className={cn(SD_ANLEGG_INFO_BANNER, "text-xs")}>{status}</p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {simResult?.ok && !("queued" in simResult && simResult.queued) ? (
        <Card className={SD_ANLEGG_CARD}>
          <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Besparelse (estimat)</p>
              <p className="text-lg font-semibold tabular-nums">
                {simResult.deltaCostPct.toFixed(1)} %
              </p>
              <p className="text-xs text-muted-foreground">
                {simResult.deltaCostKr.toFixed(0)} kr vs faktisk drift
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avtrekk utenfor band</p>
              <p className="text-lg font-semibold tabular-nums">
                {simResult.comfortViolationsMpc}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Styring endret</p>
              <p className="text-lg font-semibold tabular-nums">
                {simResult.meaningfulDeltaPct.toFixed(1)} %
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Uten optimalisering</p>
              <p className="text-lg font-semibold tabular-nums">
                {Math.round(simResult.fallbackPct * 100)} %
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
