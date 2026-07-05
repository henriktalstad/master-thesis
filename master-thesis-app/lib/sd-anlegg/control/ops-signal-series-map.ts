import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";

/** Loop-graf (u_k) → detaljtabell i signal-sammenligning. */
export const LOOP_TO_COMPARISON_SERIES: Partial<
  Record<keyof MpcControlVector, string>
> = {
  supplySetpointC: "supply_setpoint_mpc",
  supplyFanPct: "supply_fan_mpc",
  exhaustFanPct: "exhaust_fan_mpc",
  heatingValvePct: "heating_valve_mpc",
  coolingValvePct: "cooling_valve_mpc",
};

/** Kjernesignaler — vises først i signalvelger på Styring-fanen. */
export const OPS_PRIMARY_COMPARISON_SERIES = new Set([
  "supply_setpoint_operator",
  "supply_setpoint_mpc",
  "supply_fan_mpc",
  "exhaust_fan_mpc",
  "heating_valve_mpc",
  "cooling_valve_mpc",
]);
