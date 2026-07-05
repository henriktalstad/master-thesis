import type { MpcReplayResult } from "@/lib/sd-anlegg/mpc/shared/types";
import { CONTROL_EFFECT_STRATEGY_LINES } from "@/lib/sd-anlegg/control/control-display-labels";

export type EffectFlowTrackId = "observed" | "emulated" | "demand" | "mpc";

export type EffectFlowTrack = {
  id: EffectFlowTrackId;
  label: string;
  description: string;
  totalCostKr: number;
  totalEnergyKwh: number;
  role: "reference" | "comparator" | "proposed";
};

export type EffectFlowSnapshot = {
  stepCount: number;
  stepMinutes: 15;
  tracks: EffectFlowTrack[];
  heroDeltaObservedKr: number;
  heroDeltaObservedPct: number;
  heroDeltaEmulatedKr: number | null;
  heroDeltaEmulatedPct: number | null;
  measuredBuildingCostKr: number | null;
  proxyObservedCostKr: number | null;
  ventilationElSharePct: number | null;
};

const TRACK_META: Record<
  EffectFlowTrackId,
  { role: EffectFlowTrack["role"]; strategyIndex: number }
> = {
  observed: { role: "reference", strategyIndex: 0 },
  emulated: { role: "reference", strategyIndex: 1 },
  demand: { role: "comparator", strategyIndex: 2 },
  mpc: { role: "proposed", strategyIndex: 3 },
};

function roundKr(v: number): number {
  return Math.round(v * 10) / 10;
}

export function buildEffectFlowSnapshot(input: {
  replay: MpcReplayResult["summary"];
  proxyObservedCostKr?: number | null;
  measuredBuildingCostKr?: number | null;
  ventilationElSharePct?: number | null;
}): EffectFlowSnapshot {
  const { replay } = input;
  const tracks: EffectFlowTrack[] = (
    [
      {
        id: "observed" as const,
        totalCostKr: replay.totalCostBaselineKr,
        el: replay.controllableElectricKwhBaseline,
        heat: replay.controllableHeatKwhBaseline,
      },
      {
        id: "emulated" as const,
        totalCostKr: replay.totalCostEmulatedKr,
        el: replay.controllableElectricKwhEmulated ?? replay.controllableElectricKwhBaseline,
        heat: replay.controllableHeatKwhEmulated ?? replay.controllableHeatKwhBaseline,
      },
      {
        id: "demand" as const,
        totalCostKr: replay.totalCostDemandKr,
        el: replay.controllableElectricKwhDemand ?? replay.controllableElectricKwhBaseline,
        heat: replay.controllableHeatKwhDemand ?? replay.controllableHeatKwhBaseline,
      },
      {
        id: "mpc" as const,
        totalCostKr: replay.totalCostMpcKr,
        el: replay.controllableElectricKwhMpc,
        heat: replay.controllableHeatKwhMpc,
      },
    ] as const
  ).map((row) => {
    const meta = TRACK_META[row.id];
    const strategy = CONTROL_EFFECT_STRATEGY_LINES[meta.strategyIndex]!;
    return {
      id: row.id,
      label: strategy.label,
      description: strategy.line,
      totalCostKr: roundKr(row.totalCostKr),
      totalEnergyKwh: Math.round(row.el + row.heat),
      role: meta.role,
    };
  });

  return {
    stepCount: replay.stepCount,
    stepMinutes: 15,
    tracks,
    heroDeltaObservedKr: roundKr(replay.deltaCostKr),
    heroDeltaObservedPct: replay.deltaCostPct,
    heroDeltaEmulatedKr:
      replay.deltaCostVsEmulatedKr != null
        ? roundKr(replay.deltaCostVsEmulatedKr)
        : null,
    heroDeltaEmulatedPct: replay.deltaCostVsEmulatedPct ?? null,
    measuredBuildingCostKr: input.measuredBuildingCostKr ?? null,
    proxyObservedCostKr: input.proxyObservedCostKr ?? null,
    ventilationElSharePct: input.ventilationElSharePct ?? null,
  };
}
