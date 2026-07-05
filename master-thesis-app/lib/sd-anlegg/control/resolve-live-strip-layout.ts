import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";
import {
  controlComparisonDeviation,
  isControlComparisonDeviation,
} from "./control-comparison-precision";
import { CONTROL_VECTOR_UI_LABELS } from "./control-display-labels";

export const LIVE_STRIP_SIGNALS: Array<{
  key: keyof MpcControlVector;
  label: string;
  unit: "°C" | "%";
}> = [
  { key: "supplySetpointC", label: CONTROL_VECTOR_UI_LABELS.supplySetpointC, unit: "°C" },
  { key: "supplyFanPct", label: CONTROL_VECTOR_UI_LABELS.supplyFanPct, unit: "%" },
  { key: "exhaustFanPct", label: CONTROL_VECTOR_UI_LABELS.exhaustFanPct, unit: "%" },
  { key: "heatingValvePct", label: CONTROL_VECTOR_UI_LABELS.heatingValvePct, unit: "%" },
  { key: "coolingValvePct", label: CONTROL_VECTOR_UI_LABELS.coolingValvePct, unit: "%" },
];

export type LiveStripObservedVector = Partial<MpcControlVector> & {
  supplySetpointOperatorC?: number;
};

export type LiveStripSignalDeviation = {
  key: keyof MpcControlVector;
  label: string;
  unit: "°C" | "%";
  observed: number | null;
  simulated: number | null;
  delta: number | null;
  hasDeviation: boolean;
};

export type LiveStripLayout = {
  showEstimatedColumn: boolean;
  columnCount: 2 | 3;
  observedMatchesMpc: boolean;
  mpcDeviatesFromBms: boolean;
  signalDeviations: LiveStripSignalDeviation[];
  hasAnyObservedVsMpcDeviation: boolean;
};

export function observedAsControlVector(
  observed: LiveStripObservedVector,
): Partial<MpcControlVector> {
  return {
    ...observed,
    supplySetpointC: observed.supplySetpointOperatorC ?? observed.supplySetpointC,
  };
}

export function getLiveStripSignalValue(
  vector: LiveStripObservedVector | Partial<MpcControlVector> | null | undefined,
  key: keyof MpcControlVector,
): number | null {
  if (!vector) return null;
  if (key === "supplySetpointC" && "supplySetpointOperatorC" in vector) {
    const value = vector.supplySetpointOperatorC ?? vector.supplySetpointC;
    return value != null && Number.isFinite(value) ? value : null;
  }
  const value = vector[key];
  return value != null && Number.isFinite(value) ? value : null;
}

function vectorsMatch(
  a: Partial<MpcControlVector> | null | undefined,
  b: Partial<MpcControlVector> | null | undefined,
): boolean {
  if (!a || !b) return false;
  for (const { key, unit } of LIVE_STRIP_SIGNALS) {
    const av = getLiveStripSignalValue(a, key);
    const bv = getLiveStripSignalValue(b, key);
    if (av == null && bv == null) continue;
    if (isControlComparisonDeviation(av, bv, unit)) return false;
  }
  return true;
}

/** Terskel for å vise estimert kolonne — høyere enn avvik-markering (0,05). */
function estimatedColumnDeviationThreshold(unit: string): number {
  if (unit === "°C") return 0.5;
  if (unit === "%") return 3;
  return 0.05;
}

function mpcDeviatesFromTypicalBms(
  typicalBms: Partial<MpcControlVector> | null | undefined,
  mpc: Partial<MpcControlVector> | null | undefined,
): boolean {
  if (!typicalBms || !mpc) return false;
  for (const { key, unit } of LIVE_STRIP_SIGNALS) {
    const delta = controlComparisonDeviation(typicalBms[key], mpc[key], unit);
    if (delta != null && delta >= estimatedColumnDeviationThreshold(unit)) {
      return true;
    }
  }
  return false;
}

function buildSignalDeviations(
  observed: Partial<MpcControlVector>,
  mpc: Partial<MpcControlVector> | null | undefined,
): LiveStripSignalDeviation[] {
  return LIVE_STRIP_SIGNALS.map(({ key, label, unit }) => {
    const observedValue = getLiveStripSignalValue(observed, key);
    const simulatedValue = mpc ? getLiveStripSignalValue(mpc, key) : null;
    const delta =
      observedValue != null && simulatedValue != null
        ? controlComparisonDeviation(observedValue, simulatedValue, unit)
        : null;
    const hasDeviation = isControlComparisonDeviation(observedValue, simulatedValue, unit);
    return {
      key,
      label,
      unit,
      observed: observedValue,
      simulated: simulatedValue,
      delta,
      hasDeviation,
    };
  });
}

export function resolveLiveStripLayout(input: {
  observed: LiveStripObservedVector;
  typicalBms: Partial<MpcControlVector> | null | undefined;
  mpc: Partial<MpcControlVector> | null | undefined;
}): LiveStripLayout {
  const observedVector = observedAsControlVector(input.observed);
  const mpcDeviatesFromBms = mpcDeviatesFromTypicalBms(input.typicalBms, input.mpc);
  const observedMatchesMpc = vectorsMatch(observedVector, input.mpc);
  const signalDeviations = buildSignalDeviations(observedVector, input.mpc);
  const hasAnyObservedVsMpcDeviation = signalDeviations.some((row) => row.hasDeviation);
  const showEstimatedColumn = mpcDeviatesFromBms;

  return {
    showEstimatedColumn,
    columnCount: showEstimatedColumn ? 3 : 2,
    observedMatchesMpc,
    mpcDeviatesFromBms,
    signalDeviations,
    hasAnyObservedVsMpcDeviation,
  };
}
