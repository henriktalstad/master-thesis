import { clampControlPct } from "@/lib/sd-anlegg/envelope-model/power/build-proxies";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";

/** Ventil over terskel → forventet pumpe ON (følgermodell, ikke u_k). */
export const DISTRICT_PUMP_FOLLOWER_VALVE_THRESHOLD_PCT = 8;

export function districtPumpFollowerActive(valvePct: number): boolean {
  return clampControlPct(valvePct) > DISTRICT_PUMP_FOLLOWER_VALVE_THRESHOLD_PCT;
}

export function deriveDistrictPlantFollowers(
  u: Pick<MpcControlVector, "districtTr002ValvePct" | "districtTr003ValvePct">,
): {
  districtTr002PumpActive: boolean;
  districtTr003PumpActive: boolean;
} {
  return {
    districtTr002PumpActive: districtPumpFollowerActive(u.districtTr002ValvePct),
    districtTr003PumpActive: districtPumpFollowerActive(u.districtTr003ValvePct),
  };
}
