import {
  CascadeHeatRegulator,
  DirectAhuRegulator,
  type RegulatorPolicy,
} from "./regulator-policy";

/** AHU mpc-v1 bruker direkte u_k; fjernvarme cascade aktiveres via env. */
export function resolveRegulatorForBuilding(): RegulatorPolicy {
  if (process.env.MPC_USE_CASCADE_REGULATOR?.trim() === "1") {
    return new CascadeHeatRegulator();
  }
  return new DirectAhuRegulator();
}
