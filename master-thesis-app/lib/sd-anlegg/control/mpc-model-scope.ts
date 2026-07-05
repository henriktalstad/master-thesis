import {
  CONTROL_SIGNAL_SPECS_360102,
  MPC_CONTROL_CANONICALS,
  MPC_U_MEAS_CANONICALS,
} from "./control-signal-registry-360102";
import { CONTROL_SUBSYSTEM_LABELS } from "./control-signal-catalog";

/** Oppsummering av hva mpc-v1 faktisk modellerer vs. hele bygget. */
export type MpcModelScopeSummary = {
  bmsPointCountApprox: number;
  catalogSignalCount: number;
  mpcActuatorCount: number;
  districtActuatorCount: number;
  uMeasRequiredCount: number;
  evalDatasetCount: number;
  mpcActuatorLabels: string[];
  districtActuatorLabels: string[];
  uMeasLabels: string[];
  outsideMpcExamples: string[];
};

const OUTSIDE_MPC_EXAMPLES = [
  "Belysning, heiser og øvrige soner utenfor AHU/TR-kretser",
  "Hele byggets el/FV (BHCC) — proxy er estimert andel, ikke submåler",
  "Effektledd el og FV-effekttariff i faktura",
  "Kjølevolum i BHCC (ikke koblet til AHU-kjølebatteri i mpc-v1)",
  "Driftsmodus, spjeld, varmegjenvinning og tidsplan (forventet mangler i SD)",
  "TR002/TR003 pumper — følgermodell fra ventil, ikke egne u_k-kanaler",
] as const;

export function buildMpcModelScopeSummary(): MpcModelScopeSummary {
  const mpcActuators = CONTROL_SIGNAL_SPECS_360102.filter(
    (s) => s.controlRole === "mpc_actuator" || s.controlRole === "district_actuator",
  );
  const districtActuators = CONTROL_SIGNAL_SPECS_360102.filter(
    (s) => s.controlRole === "district_actuator",
  );
  const uMeasSpecs = CONTROL_SIGNAL_SPECS_360102.filter((s) => s.inUMeasRequired);

  return {
    bmsPointCountApprox: 123,
    catalogSignalCount: CONTROL_SIGNAL_SPECS_360102.length,
    mpcActuatorCount: mpcActuators.length,
    districtActuatorCount: districtActuators.length,
    uMeasRequiredCount: MPC_U_MEAS_CANONICALS.length,
    evalDatasetCount: CONTROL_SIGNAL_SPECS_360102.filter((s) => s.inEvalDataset).length,
    mpcActuatorLabels: mpcActuators.map((s) => s.label),
    districtActuatorLabels: districtActuators.map((s) => s.label),
    uMeasLabels: uMeasSpecs.map((s) => s.label),
    outsideMpcExamples: [...OUTSIDE_MPC_EXAMPLES],
  };
}

export { CONTROL_SUBSYSTEM_LABELS, MPC_CONTROL_CANONICALS };
