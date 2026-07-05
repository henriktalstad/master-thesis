import type { MpcControlVector, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import {
  MPC_EVAL_DISTRICT_CANONICALS,
  MPC_EVAL_EXTRA_PLANT_CANONICALS,
  pickObservedReplayValue,
  specForCanonical,
} from "./control-signal-registry-360102";
import {
  MPC_PLANT_OBSERVATION_CANONICALS,
  type MpcPlantObservationCanonical,
} from "@/services/mpc/mpc-canonicals";

type VectorField = keyof MpcControlVector;

export type MpcComparisonSeriesPick = {
  id: string;
  label: string;
  tabLabel: string;
  unit: string;
  pickObserved: (step: MpcReplayStep) => number | null | undefined;
  pickEmulated?: (step: MpcReplayStep) => number | null | undefined;
  pickMpc?: (step: MpcReplayStep) => number | null | undefined;
  pickReference?: (step: MpcReplayStep) => number | null | undefined;
  referenceLabel?: string;
  requireObservedAndMpc?: boolean;
  chartVariant?: "policy" | "observed" | "observed_with_reference";
};

function pickVectorField(
  vector: MpcControlVector | null | undefined,
  field: VectorField,
): number | undefined {
  const value = vector?.[field];
  return value != null && Number.isFinite(value) ? value : undefined;
}

function vectorSeries(
  id: string,
  label: string,
  tabLabel: string,
  unit: string,
  field: VectorField,
): MpcComparisonSeriesPick {
  return {
    id,
    label,
    tabLabel,
    unit,
    chartVariant: "policy",
    requireObservedAndMpc: true,
    pickObserved: (step) => pickVectorField(step.uBmsMeas, field),
    pickEmulated: (step) => pickVectorField(step.uBmsSim, field),
    pickMpc: (step) => pickVectorField(step.uMpc, field),
  };
}

const supplySetpointOperatorSpec = specForCanonical("supply.setpoint")!;
const supplySetpointCalcSpec = specForCanonical("supply.setpoint_calculated")!;
export const MPC_COMPARISON_BMS_SETPOINT_SERIES: readonly MpcComparisonSeriesPick[] = [
  {
    id: "supply_setpoint_operator",
    label: supplySetpointOperatorSpec.label,
    tabLabel: "Operatør SP",
    unit: "°C",
    chartVariant: "observed_with_reference",
    pickObserved: (step) => pickObservedReplayValue(step, supplySetpointOperatorSpec),
    pickReference: (step) => pickObservedReplayValue(step, supplySetpointCalcSpec),
    referenceLabel: "Aktiv calc SP",
  },
];

const PLANT_SERIES_BY_CANONICAL: Record<
  MpcPlantObservationCanonical,
  Omit<MpcComparisonSeriesPick, "pickObserved" | "pickEmulated" | "pickMpc"> & {
    pickObserved: (step: MpcReplayStep) => number | null | undefined;
    pickMpc?: (step: MpcReplayStep) => number | null | undefined;
  }
> = {
  "supply.temp": {
    id: "supply_temp_meas",
    label: "Temp. tilluft (målt)",
    tabLabel: "Tilluft temp",
    unit: "°C",
    pickObserved: (step) => step.supplyTempMeasC,
  },
  "intake.temp": {
    id: "intake_temp_meas",
    label: "Temp. inntak",
    tabLabel: "Inntak temp",
    unit: "°C",
    pickObserved: (step) => step.intakeTempMeasC,
  },
  "extract.setpoint": {
    id: "extract_setpoint_obs",
    label: "Settpunkt avtrekk",
    tabLabel: "Avtrekk SP",
    unit: "°C",
    pickObserved: (step) => step.extractSetpointC,
  },
  "extract.temp": {
    id: "extract_temp_comfort",
    label: "Temp. avtrekk (komfortproxy)",
    tabLabel: "Avtrekk temp",
    unit: "°C",
    pickObserved: (step) => step.extractTempMeasC,
    pickMpc: (step) => step.extractTempPredC,
  },
  "heat_recovery.after_temp": {
    id: "heat_recovery_after_temp",
    label: "Temp. etter gjenvinner",
    tabLabel: "Etter RV",
    unit: "°C",
    pickObserved: (step) => step.heatRecoveryAfterTempC,
    pickMpc: (step) => step.heatRecoveryAfterTempPredC,
  },
};

export const MPC_COMPARISON_VECTOR_SERIES: readonly MpcComparisonSeriesPick[] = [
  vectorSeries(
    "supply_setpoint_mpc",
    "Aktiv tilluft SP (calc, u_k)",
    "Tilluft SP (aktiv)",
    "°C",
    "supplySetpointC",
  ),
  vectorSeries("supply_fan_mpc", "Tilluftvifte", "Tilluftvifte", "%", "supplyFanPct"),
  vectorSeries("exhaust_fan_mpc", "Avtrekkvifte", "Avtrekkvifte", "%", "exhaustFanPct"),
  vectorSeries(
    "heating_valve_mpc",
    "Varmebatteri",
    "Varmebatteri",
    "%",
    "heatingValvePct",
  ),
  vectorSeries("cooling_valve_mpc", "Kjølebatteri", "Kjøling", "%", "coolingValvePct"),
  vectorSeries(
    "district_tr002_valve_mpc",
    "TR002 ventil",
    "TR002 ventil",
    "%",
    "districtTr002ValvePct",
  ),
  vectorSeries(
    "district_tr003_valve_mpc",
    "TR003 ventil",
    "TR003 ventil",
    "%",
    "districtTr003ValvePct",
  ),
];

export const MPC_COMPARISON_PLANT_SERIES: readonly MpcComparisonSeriesPick[] =
  MPC_PLANT_OBSERVATION_CANONICALS.map((canonicalId) => {
    const spec = PLANT_SERIES_BY_CANONICAL[canonicalId];
    return {
      id: spec.id,
      label: spec.label,
      tabLabel: spec.tabLabel,
      unit: spec.unit,
      pickObserved: spec.pickObserved,
      pickMpc: spec.pickMpc,
    };
  });

const EXTRA_PLANT_TAB_LABELS: Record<
  (typeof MPC_EVAL_EXTRA_PLANT_CANONICALS)[number],
  string
> = {
  "heating.coil_temp": "Frost temp",
  "supply.fan.flow": "Tilluft flow",
  "exhaust.fan.flow": "Avtrekk flow",
  "heat_recovery.efficiency": "RV virkn.",
  "cooling.valve.position": "Kjøling pos",
  "ventilation.sfp": "SFP",
  "system.mode": "Modus",
  "heat_recovery.rotation_guard": "RV-vakt",
  "heating.pump.malfunction": "Pumpealarm varme",
  "cooling.pump.malfunction": "Pumpealarm kjøling",
};

function plantSeriesId(canonicalId: string): string {
  return canonicalId.replace(/\./g, "_");
}
export const MPC_COMPARISON_EXTRA_PLANT_SERIES: readonly MpcComparisonSeriesPick[] =
  MPC_EVAL_EXTRA_PLANT_CANONICALS.map((canonicalId) => {
    const spec = specForCanonical(canonicalId)!;
    return {
      id: plantSeriesId(canonicalId),
      label: spec.label,
      tabLabel: EXTRA_PLANT_TAB_LABELS[canonicalId],
      unit: spec.unit,
      pickObserved: (step) => pickObservedReplayValue(step, spec),
    };
  });

const DISTRICT_TAB_LABELS: Partial<
  Record<(typeof MPC_EVAL_DISTRICT_CANONICALS)[number], string>
> = {
  "district.tr002.valve.command": "TR002 ventil",
  "district.tr003.valve.command": "TR003 ventil",
  "district.tr002.supply.temp": "TR002 tur",
  "district.tr003.supply.temp": "TR003 tur",
  "district.tr002.return.temp": "TR002 retur",
  "district.tr003.return.temp": "TR003 retur",
  "district.tr002.supply.setpoint": "TR002 tur-SP",
  "district.tr003.supply.setpoint": "TR003 tur-SP",
  "district.meter.tr002.energy": "OE001 bolig kWh",
  "district.meter.tr003.energy": "OE001 næring kWh",
  "district.meter.tr002.power": "OE001 bolig kW",
  "district.meter.tr003.power": "OE001 næring kW",
  "district.meter.tr002.supply.temp": "OE001 bolig tur",
  "district.meter.tr003.supply.temp": "OE001 næring tur",
  "district.meter.tr002.return.temp": "OE001 bolig retur",
  "district.meter.tr003.return.temp": "OE001 næring retur",
  "district.tr002.pump.status": "TR002 pumpe",
  "district.tr003.pump.status": "TR003 pumpe",
};

const MPC_EVAL_DISTRICT_PLANT_CANONICALS = [
  "district.tr002.supply.temp",
  "district.tr003.supply.temp",
  "district.tr002.return.temp",
  "district.tr003.return.temp",
  "district.tr002.supply.setpoint",
  "district.tr003.supply.setpoint",
  "district.meter.tr002.energy",
  "district.meter.tr003.energy",
  "district.meter.tr002.power",
  "district.meter.tr003.power",
  "district.meter.tr002.supply.temp",
  "district.meter.tr003.supply.temp",
  "district.meter.tr002.return.temp",
  "district.meter.tr003.return.temp",
] as const;
export const MPC_COMPARISON_DISTRICT_SERIES: readonly MpcComparisonSeriesPick[] =
  MPC_EVAL_DISTRICT_PLANT_CANONICALS.map((canonicalId) => {
    const spec = specForCanonical(canonicalId)!;
    return {
      id: plantSeriesId(canonicalId),
      label: spec.label,
      tabLabel: DISTRICT_TAB_LABELS[canonicalId] ?? spec.label,
      unit: spec.unit,
      chartVariant: "observed" as const,
      pickObserved: (step) => pickObservedReplayValue(step, spec),
    };
  });
export const MPC_COMPARISON_DISTRICT_PUMP_SERIES: readonly MpcComparisonSeriesPick[] =
  [
    {
      id: "district_tr002_pump_follower",
      label: "TR002 pumpe observert vs avledet",
      tabLabel: "TR002 pumpe",
      unit: "",
      chartVariant: "observed_with_reference",
      pickObserved: (step) =>
        step.districtTr002PumpObserved == null
          ? null
          : step.districtTr002PumpObserved
            ? 1
            : 0,
      pickReference: (step) => (step.districtTr002PumpActive ? 1 : 0),
      referenceLabel: "Avledet (ventil)",
    },
    {
      id: "district_tr003_pump_follower",
      label: "TR003 pumpe observert vs avledet",
      tabLabel: "TR003 pumpe",
      unit: "",
      chartVariant: "observed_with_reference",
      pickObserved: (step) =>
        step.districtTr003PumpObserved == null
          ? null
          : step.districtTr003PumpObserved
            ? 1
            : 0,
      pickReference: (step) => (step.districtTr003PumpActive ? 1 : 0),
      referenceLabel: "Avledet (ventil)",
    },
  ];

export const MPC_COMPARISON_DISTURBANCE_SERIES: readonly MpcComparisonSeriesPick[] = [
  {
    id: "outdoor_temp_cross",
    label: "Utetemperatur Frost vs BMS",
    tabLabel: "Utetemp",
    unit: "°C",
    pickObserved: (step) =>
      step.outdoorTempFrostC ?? step.outdoorTempC,
    pickEmulated: (step) => step.outdoorTempBmsC,
  },
];

export const MPC_COMPARISON_SERIES: readonly MpcComparisonSeriesPick[] = [
  ...MPC_COMPARISON_BMS_SETPOINT_SERIES,
  ...MPC_COMPARISON_VECTOR_SERIES,
  ...MPC_COMPARISON_PLANT_SERIES,
  ...MPC_COMPARISON_EXTRA_PLANT_SERIES,
  ...MPC_COMPARISON_DISTRICT_SERIES,
  ...MPC_COMPARISON_DISTRICT_PUMP_SERIES,
  ...MPC_COMPARISON_DISTURBANCE_SERIES,
];
export function mpcStepComparisonNeedsRebuild(
  cached: { series: readonly { id: string }[] } | null | undefined,
): boolean {
  if (!cached) return true;
  const ids = new Set(cached.series.map((s) => s.id));
  return MPC_COMPARISON_SERIES.some((pick) => !ids.has(pick.id));
}
