import type {
  ControlPlantModel,
  ControlSignalAvailability,
  MpcEvalCoverageSummary,
} from "./control-types";
import {
  CONTROL_SIGNAL_SPECS_360102,
  type ControlSignalRole,
  type ControlSignalSpec360102,
} from "./control-signal-registry-360102";
import { CONTROL_SUBSYSTEM_LABELS } from "./control-signal-catalog";
import type { ResolvedControlSignal } from "./control-types";

export type SignalCatalogRow = {
  spec: ControlSignalSpec360102;
  availability: ControlSignalAvailability;
  lastValue: number | null;
  objectName: string | null;
  evalSamplePct: number | null;
};

export const CONTROL_ROLE_LABELS: Record<ControlSignalRole, string> = {
  mpc_actuator: "MPC-pådrag",
  district_actuator: "Fjernvarme-pådrag",
  bms_setpoint: "BMS-settpunkt",
  plant_measurement: "Plantmåling",
  disturbance: "Forstyrrelse",
  constraint: "Begrensning",
  operational_mode: "Driftsmodus",
  operational_command: "Driftskommando",
  bms_configuration: "BMS-konfigurasjon",
};

function flattenPlantSignals(
  plantModel: ControlPlantModel,
): Map<string, ResolvedControlSignal> {
  const map = new Map<string, ResolvedControlSignal>();
  for (const subsystem of plantModel.subsystems) {
    for (const signal of [
      ...subsystem.controls,
      ...subsystem.states,
      ...subsystem.constraints,
    ]) {
      map.set(signal.catalog.canonicalId, signal);
    }
  }
  return map;
}

export function buildSignalCatalogRows(input: {
  plantModel: ControlPlantModel;
  evalCoverage?: MpcEvalCoverageSummary | null;
}): SignalCatalogRow[] {
  const resolved = flattenPlantSignals(input.plantModel);
  const stepCount = input.evalCoverage?.stepCount ?? 0;
  const evalByCanonical = new Map(
    (input.evalCoverage?.signals ?? []).map((s) => [s.canonicalId, s.sampleStepCount]),
  );

  return CONTROL_SIGNAL_SPECS_360102.map((spec) => {
    const live = resolved.get(spec.canonicalId);
    const sampleCount = evalByCanonical.get(spec.canonicalId);
    return {
      spec,
      availability: live?.availability ?? (spec.expectedMissing ? "expected_missing" : "missing"),
      lastValue: live?.lastValue ?? null,
      objectName: live?.point?.objectName ?? null,
      evalSamplePct:
        sampleCount != null && stepCount > 0
          ? Math.round((sampleCount / stepCount) * 1000) / 10
          : null,
    };
  });
}

export function summarizeSignalCatalog(rows: readonly SignalCatalogRow[]): {
  total: number;
  available: number;
  expectedMissing: number;
  mpcActuators: number;
  uMeasRequired: number;
  inEval: number;
  criticalMissing: string[];
} {
  const criticalMissing = rows
    .filter((r) => r.spec.critical && r.availability !== "available")
    .map((r) => r.spec.label);

  return {
    total: rows.length,
    available: rows.filter((r) => r.availability === "available").length,
    expectedMissing: rows.filter((r) => r.availability === "expected_missing").length,
    mpcActuators: rows.filter((r) => r.spec.controlRole === "mpc_actuator").length,
    uMeasRequired: rows.filter((r) => r.spec.inUMeasRequired).length,
    inEval: rows.filter((r) => r.spec.inEvalDataset).length,
    criticalMissing,
  };
}

export { CONTROL_SUBSYSTEM_LABELS };
