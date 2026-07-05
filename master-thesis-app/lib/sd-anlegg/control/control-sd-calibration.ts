import { controlHourKeyFromIso } from "./control-time-buckets";
import { isCoolingValveThermallyActive } from "./resolve-cooling-valve-pct";

export type ControlSdHourlyProfile = {
  hour: string;
  supplySetpointC?: number;
  supplySetpointCalcC?: number;
  extractSetpointC?: number;
  supplyFanPct?: number;
  exhaustFanPct?: number;
  heatingValvePct?: number;
  coolingValvePct?: number;
  extractTempC?: number;
  supplyTempC?: number;
};

export function sdProfileHourKey(hour: string): string {
  return hour.length <= 13 ? hour : controlHourKeyFromIso(hour);
}

export function sdProfileByHour(
  profiles: readonly ControlSdHourlyProfile[],
): Map<string, ControlSdHourlyProfile> {
  return new Map(profiles.map((p) => [sdProfileHourKey(p.hour), p]));
}

export function estimateFanElectricityShare(
  profile: ControlSdHourlyProfile | undefined,
): number {
  if (!profile) return 0.2;
  const avgFan =
    ((profile.supplyFanPct ?? 0) + (profile.exhaustFanPct ?? 0)) / 2;
  if (avgFan <= 0) return 0.15;
  return Math.min(0.45, Math.max(0.1, (avgFan / 100) * 0.4));
}

export function estimateHeatingActive(
  profile: ControlSdHourlyProfile | undefined,
): boolean {
  if (!profile) return false;
  return (profile.heatingValvePct ?? 0) > 8;
}

export function estimateCoolingActive(
  profile: ControlSdHourlyProfile | undefined,
  outdoorTempC?: number | null,
): boolean {
  if (!profile) return false;
  return isCoolingValveThermallyActive(
    profile.coolingValvePct ?? 0,
    outdoorTempC,
  );
}

export function simultaneousHeatCool(
  profile: ControlSdHourlyProfile | undefined,
  outdoorTempC?: number | null,
): boolean {
  return (
    estimateHeatingActive(profile) &&
    estimateCoolingActive(profile, outdoorTempC)
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundPct(value: number): number {
  return Math.round(value);
}

function dowHourKey(hourIso: string): string {
  const d = new Date(hourIso);
  return `${d.getUTCDay()}-${d.getUTCHours()}`;
}

type ProfileAccumulator = {
  hour: string;
  count: number;
  supplySetpointC: number;
  supplySetpointCalcC: number;
  extractSetpointC: number;
  supplyFanPct: number;
  exhaustFanPct: number;
  heatingValvePct: number;
  coolingValvePct: number;
  extractTempC: number;
  supplyTempC: number;
};

function mergeProfileField(
  acc: ProfileAccumulator,
  profile: ControlSdHourlyProfile,
): void {
  if (profile.supplySetpointC != null) {
    acc.supplySetpointC += profile.supplySetpointC;
  }
  if (profile.supplySetpointCalcC != null) {
    acc.supplySetpointCalcC += profile.supplySetpointCalcC;
  }
  if (profile.extractSetpointC != null) {
    acc.extractSetpointC += profile.extractSetpointC;
  }
  if (profile.supplyFanPct != null) {
    acc.supplyFanPct += profile.supplyFanPct;
  }
  if (profile.exhaustFanPct != null) {
    acc.exhaustFanPct += profile.exhaustFanPct;
  }
  if (profile.heatingValvePct != null) {
    acc.heatingValvePct += profile.heatingValvePct;
  }
  if (profile.coolingValvePct != null) {
    acc.coolingValvePct += profile.coolingValvePct;
  }
  if (profile.extractTempC != null) {
    acc.extractTempC += profile.extractTempC;
  }
  if (profile.supplyTempC != null) {
    acc.supplyTempC += profile.supplyTempC;
  }
}

function finalizeProfileAccumulator(
  acc: ProfileAccumulator,
): ControlSdHourlyProfile {
  const count = acc.count;
  return {
    hour: acc.hour,
    supplySetpointC:
      acc.supplySetpointC > 0 ? round1(acc.supplySetpointC / count) : undefined,
    supplySetpointCalcC:
      acc.supplySetpointCalcC > 0
        ? round1(acc.supplySetpointCalcC / count)
        : undefined,
    extractSetpointC:
      acc.extractSetpointC > 0
        ? round1(acc.extractSetpointC / count)
        : undefined,
    supplyFanPct:
      acc.supplyFanPct > 0 ? roundPct(acc.supplyFanPct / count) : undefined,
    exhaustFanPct:
      acc.exhaustFanPct > 0 ? roundPct(acc.exhaustFanPct / count) : undefined,
    heatingValvePct:
      acc.heatingValvePct > 0
        ? roundPct(acc.heatingValvePct / count)
        : undefined,
    coolingValvePct:
      acc.coolingValvePct > 0
        ? roundPct(acc.coolingValvePct / count)
        : undefined,
    extractTempC:
      acc.extractTempC > 0 ? round1(acc.extractTempC / count) : undefined,
    supplyTempC:
      acc.supplyTempC > 0 ? round1(acc.supplyTempC / count) : undefined,
  };
}
export function averageProfileByDowHour(
  profiles: readonly ControlSdHourlyProfile[],
): Map<string, ControlSdHourlyProfile> {
  const sums = new Map<string, ProfileAccumulator>();
  for (const profile of profiles) {
    const key = dowHourKey(profile.hour);
    const prev = sums.get(key);
    if (!prev) {
      sums.set(key, {
        hour: profile.hour,
        count: 1,
        supplySetpointC: profile.supplySetpointC ?? 0,
        supplySetpointCalcC: profile.supplySetpointCalcC ?? 0,
        extractSetpointC: profile.extractSetpointC ?? 0,
        supplyFanPct: profile.supplyFanPct ?? 0,
        exhaustFanPct: profile.exhaustFanPct ?? 0,
        heatingValvePct: profile.heatingValvePct ?? 0,
        coolingValvePct: profile.coolingValvePct ?? 0,
        extractTempC: profile.extractTempC ?? 0,
        supplyTempC: profile.supplyTempC ?? 0,
      });
      continue;
    }
    prev.count += 1;
    mergeProfileField(prev, profile);
  }
  return new Map(
    Array.from(sums.entries()).map(([key, acc]) => [
      key,
      finalizeProfileAccumulator(acc),
    ]),
  );
}

export type SdProfileTemplates = {
  byDowHour: Map<string, ControlSdHourlyProfile>;
  fallback: ControlSdHourlyProfile | undefined;
};

export function buildSdProfileTemplates(
  sdByHour: ReadonlyMap<string, ControlSdHourlyProfile>,
): SdProfileTemplates {
  const profiles = Array.from(sdByHour.values());
  return {
    byDowHour: averageProfileByDowHour(profiles),
    fallback: profiles[profiles.length - 1],
  };
}
export function resolveSdProfileForHour(
  hourIso: string,
  sdByHour: ReadonlyMap<string, ControlSdHourlyProfile>,
  templates: SdProfileTemplates,
): ControlSdHourlyProfile | undefined {
  const key = sdProfileHourKey(hourIso);
  const exact = sdByHour.get(key);
  if (exact) return { ...exact, hour: hourIso };

  const templ = templates.byDowHour.get(dowHourKey(hourIso));
  if (templ) return { ...templ, hour: hourIso };

  if (templates.fallback) return { ...templates.fallback, hour: hourIso };
  return undefined;
}
