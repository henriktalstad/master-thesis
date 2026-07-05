/** AO_5 / AV-40374 kan rapportere 100 % uten fysisk åpen ventil. */
import { CONTROL_SIGNAL_CATALOG_360102 } from "./control-signal-catalog";
import type { ControlSdHourlyProfile } from "./control-sd-calibration";
import { resolvePointForCatalogEntry } from "./resolve-control-signals";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export const COOLING_VALVE_SATURATED_COMMAND_PCT = 99;

export const COOLING_VALVE_MIN_ACTIVE_PCT = 8;

/** Under denne utetemp antas kjølebehov lite sannsynlig. */
export const COOLING_MIN_OUTDOOR_TEMP_C = 16;

export type CoolingValveTrustSource =
  | "command"
  | "feedback"
  | "zero_saturated"
  | "zero_no_cooling_context";

export type CoolingValveResolveInput = {
  commandPct?: number | null;
  feedbackPct?: number | null;
  outdoorTempC?: number | null;
};

export type CoolingValveResolveResult = {
  trustedPct: number;
  source: CoolingValveTrustSource;
  rawCommandPct: number;
  feedbackPct: number | null;
};

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function isCoolingValveThermallyActive(
  coolingValvePct: number,
  outdoorTempC?: number | null,
): boolean {
  if (coolingValvePct <= COOLING_VALVE_MIN_ACTIVE_PCT) return false;
  if (outdoorTempC != null && outdoorTempC < COOLING_MIN_OUTDOOR_TEMP_C) {
    return false;
  }
  return true;
}

/**
 * Velger pålitelig kjøleventil-% for uMeas.
 * Mettet pådrag (≥99 %): 0 ved lav utetemp, ellers feedback.
 */
export function resolveTrustedCoolingValvePct(
  input: CoolingValveResolveInput,
): CoolingValveResolveResult {
  const rawCommandPct = input.commandPct ?? 0;
  const feedbackPct =
    input.feedbackPct != null && Number.isFinite(input.feedbackPct)
      ? clampPct(input.feedbackPct)
      : null;

  if (rawCommandPct < COOLING_VALVE_SATURATED_COMMAND_PCT) {
    return {
      trustedPct: clampPct(rawCommandPct),
      source: "command",
      rawCommandPct,
      feedbackPct,
    };
  }

  if (
    input.outdoorTempC != null &&
    input.outdoorTempC < COOLING_MIN_OUTDOOR_TEMP_C
  ) {
    return {
      trustedPct: 0,
      source: "zero_no_cooling_context",
      rawCommandPct,
      feedbackPct,
    };
  }

  if (feedbackPct != null) {
    return {
      trustedPct: feedbackPct,
      source: "feedback",
      rawCommandPct,
      feedbackPct,
    };
  }

  return {
    trustedPct: 0,
    source: "zero_saturated",
    rawCommandPct,
    feedbackPct,
  };
}

export function resolveCoolingValveFeedbackObjectId(
  points: readonly InfraspawnPointListItem[],
): string | null {
  const entry = CONTROL_SIGNAL_CATALOG_360102.find(
    (e) => e.canonicalId === "cooling.valve.position",
  );
  if (!entry) return null;
  return resolvePointForCatalogEntry(points, entry)?.objectId ?? null;
}

export function finalizeSdProfileCoolingValve(
  profile: ControlSdHourlyProfile,
  input: {
    feedbackByTimeKey?: ReadonlyMap<string, number>;
    timeKey: string;
    outdoorTempC?: number | null;
  },
): ControlSdHourlyProfile {
  if (profile.coolingValvePct == null) return profile;
  const resolved = resolveTrustedCoolingValvePct({
    commandPct: profile.coolingValvePct,
    feedbackPct: input.feedbackByTimeKey?.get(input.timeKey),
    outdoorTempC: input.outdoorTempC ?? null,
  });
  if (resolved.trustedPct === profile.coolingValvePct) return profile;
  return { ...profile, coolingValvePct: resolved.trustedPct };
}
