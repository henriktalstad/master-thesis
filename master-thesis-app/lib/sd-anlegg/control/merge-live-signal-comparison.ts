import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { mpcStepKeyFromMs } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import type { ControlSdHourlyProfile } from "./control-sd-calibration";
import { applyFactorsToControlProfile } from "./scenario-hour-adjustments";
import type {
  ControlLiveSignalSnapshot,
  ControlShadowAdjustments,
  ControlSignalComparison,
} from "./control-types";
import { CONTROL_SIGNAL_CATALOG_360102 } from "./control-signal-catalog";
import { resolvePointForCatalogEntry } from "./resolve-control-signals";
import { resolveTrustedCoolingValvePct } from "./resolve-cooling-valve-pct";

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function liveProfileFromPoints(
  livePoints: readonly InfraspawnPointListItem[],
  stepIso: string,
): ControlSdHourlyProfile {
  const profile: ControlSdHourlyProfile = { hour: stepIso };
  let coolingCommand: number | undefined;
  let coolingFeedback: number | undefined;

  for (const entry of CONTROL_SIGNAL_CATALOG_360102) {
    const point = resolvePointForCatalogEntry(livePoints, entry);
    const value = point?.lastValue;
    if (value == null || Number.isNaN(value)) continue;
    switch (entry.canonicalId) {
      case "supply.setpoint":
        profile.supplySetpointC = round1(value);
        break;
      case "supply.setpoint_calculated":
        profile.supplySetpointCalcC = round1(value);
        break;
      case "supply.fan.command":
        profile.supplyFanPct = round1(value);
        break;
      case "exhaust.fan.command":
        profile.exhaustFanPct = round1(value);
        break;
      case "heating.valve.command":
        profile.heatingValvePct = round1(value);
        break;
      case "cooling.valve.command":
        coolingCommand = round1(value);
        break;
      case "cooling.valve.position":
        coolingFeedback = round1(value);
        break;
      case "supply.temp":
        profile.supplyTempC = round1(value);
        break;
      case "extract.temp":
        profile.extractTempC = round1(value);
        break;
      default:
        break;
    }
  }

  if (coolingCommand != null) {
    profile.coolingValvePct = resolveTrustedCoolingValvePct({
      commandPct: coolingCommand,
      feedbackPct: coolingFeedback,
    }).trustedPct;
  }

  return profile;
}

function patchSeriesPoint(
  comparison: ControlSignalComparison,
  stepIso: string,
  observed: ControlSdHourlyProfile,
  shadow: ControlSdHourlyProfile,
): ControlSignalComparison {
  const patches: Array<{
    seriesId: string;
    pickObserved: (p: ControlSdHourlyProfile) => number | undefined;
    pickShadow: (p: ControlSdHourlyProfile) => number | undefined;
  }> = [
    {
      seriesId: "supply_setpoint_scoped",
      pickObserved: (p) => p.supplySetpointC,
      pickShadow: (p) => p.supplySetpointC,
    },
    {
      seriesId: "supply_fan_scoped",
      pickObserved: (p) => p.supplyFanPct,
      pickShadow: (p) => p.supplyFanPct,
    },
    {
      seriesId: "exhaust_fan_scoped",
      pickObserved: (p) => p.exhaustFanPct,
      pickShadow: (p) => p.exhaustFanPct,
    },
    {
      seriesId: "heating_valve_scoped",
      pickObserved: (p) => p.heatingValvePct,
      pickShadow: (p) => p.heatingValvePct,
    },
    {
      seriesId: "supply_setpoint_vs_measured",
      pickObserved: (p) => p.supplySetpointC,
      pickShadow: (p) => p.supplyTempC,
    },
  ];

  const series = comparison.series.map((s) => {
    const patch = patches.find((p) => p.seriesId === s.id);
    if (!patch) return s;

    const obs = patch.pickObserved(observed);
    const sh = patch.pickShadow(shadow);
    if (obs == null || sh == null) return s;

    const points = [...s.points];
    const idx = points.findIndex((p) => p.hour === stepIso);
    const nextPoint = {
      hour: stepIso,
      primary: obs,
      secondary: sh,
      deltaCostKr: idx >= 0 ? points[idx]?.deltaCostKr ?? null : null,
    };
    if (idx >= 0) points[idx] = nextPoint;
    else {
      points.push(nextPoint);
      points.sort(
        (a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime(),
      );
    }

    return { ...s, points };
  });

  return { ...comparison, series };
}

export function mergeLiveSignalComparison(input: {
  comparison: ControlSignalComparison;
  livePoints: readonly InfraspawnPointListItem[] | undefined;
  liveSampledAt: string | null;
  shadowAdjustments: ControlShadowAdjustments | null;
  liveSnapshot: ControlLiveSignalSnapshot | null;
}): {
  comparison: ControlSignalComparison;
  liveSnapshot: ControlLiveSignalSnapshot | null;
} {
  if (!input.livePoints?.length || !input.liveSampledAt || !input.shadowAdjustments) {
    return { comparison: input.comparison, liveSnapshot: input.liveSnapshot };
  }

  const sampledMs = new Date(input.liveSampledAt).getTime();
  if (Number.isNaN(sampledMs)) {
    return { comparison: input.comparison, liveSnapshot: input.liveSnapshot };
  }

  const stepIso = mpcStepKeyFromMs(sampledMs);
  const observed = liveProfileFromPoints(input.livePoints, stepIso);
  const shadow = applyFactorsToControlProfile(observed, {
    elecFactor: 1,
    heatFactor: 1,
    controlAdjusted: true,
    ...input.shadowAdjustments,
  });
  if (!shadow) {
    return { comparison: input.comparison, liveSnapshot: input.liveSnapshot };
  }

  const pick = (p: ControlSdHourlyProfile) => ({
    supplySetpointC: p.supplySetpointC,
    supplyFanPct: p.supplyFanPct,
    exhaustFanPct: p.exhaustFanPct,
    heatingValvePct: p.heatingValvePct,
  });

  const liveSnapshot: ControlLiveSignalSnapshot = {
    stepIso,
    sd: pick(observed),
    shadow: pick(shadow),
    deltaCostKrQuarter: input.liveSnapshot?.deltaCostKrQuarter ?? null,
  };

  const comparison = patchSeriesPoint(
    input.comparison,
    stepIso,
    observed,
    shadow,
  );

  return { comparison, liveSnapshot };
}
