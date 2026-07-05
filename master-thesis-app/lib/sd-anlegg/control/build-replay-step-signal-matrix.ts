import {
  CONTROL_SIGNAL_SPECS_360102,
  pickObservedReplayValue,
  pickPolicyReplayValue,
  type ReplayPolicyColumn,
} from "@/lib/sd-anlegg/control/control-signal-registry-360102";
import type { ControlCatalogEntry } from "@/lib/sd-anlegg/control/control-types";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

export type { ReplayPolicyColumn as ReplaySignalPolicyColumn };

export type ReplayStepSignalRow = {
  canonicalId: string;
  label: string;
  kind: ControlCatalogEntry["kind"];
  subsystem: ControlCatalogEntry["subsystem"];
  controlRole: string;
  unit: string;
  observed: number | null;
  emulated: number | null;
  demand: number | null;
  mpc: number | null;
};

export function buildReplayStepSignalMatrix(
  step: MpcReplayStep,
): ReplayStepSignalRow[] {
  return CONTROL_SIGNAL_SPECS_360102.map((spec) => ({
    canonicalId: spec.canonicalId,
    label: spec.label,
    kind: spec.kind,
    subsystem: spec.subsystem,
    controlRole: spec.controlRole,
    unit: spec.unit,
    observed: pickObservedReplayValue(step, spec),
    emulated: pickPolicyReplayValue(step, spec, "emulated"),
    demand: pickPolicyReplayValue(step, spec, "demand"),
    mpc: pickPolicyReplayValue(step, spec, "mpc"),
  }));
}

export function replayStepObservedSignals(
  step: MpcReplayStep,
): Record<string, number | null> {
  return Object.fromEntries(
    buildReplayStepSignalMatrix(step).map((row) => [row.canonicalId, row.observed]),
  );
}

export function groupReplaySignalRowsByKind(
  rows: readonly ReplayStepSignalRow[],
): Record<ControlCatalogEntry["kind"], ReplayStepSignalRow[]> {
  const groups: Record<ControlCatalogEntry["kind"], ReplayStepSignalRow[]> = {
    control: [],
    measured_state: [],
    derived_state: [],
    disturbance: [],
    constraint: [],
    objective: [],
  };
  for (const row of rows) {
    groups[row.kind].push(row);
  }
  return groups;
}

export { CONTROL_SUBSYSTEM_LABELS } from "@/lib/sd-anlegg/control/control-signal-registry-360102";
