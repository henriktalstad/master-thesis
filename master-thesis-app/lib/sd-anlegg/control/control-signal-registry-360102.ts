import type {
  ControlCatalogEntry,
  ControlSignalKind,
  ControlSubsystem,
} from "./control-types";
import type { MpcControlVector, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

/** Styring vs måling vs forstyrrelse — matcher MPC-implementasjonen. */
export type ControlSignalRole =
  | "mpc_actuator"
  | "district_actuator"
  | "bms_setpoint"
  | "plant_measurement"
  | "disturbance"
  | "constraint"
  | "operational_mode"
  | "operational_command"
  | "bms_configuration";

export type ControlSignalSpec360102 = ControlCatalogEntry & {
  controlRole: ControlSignalRole;
  unit: string;
  /** Felt i u_k (kun mpc_actuator). */
  uVectorField?: keyof MpcControlVector;
  /** Inkluderes i eval-datasett (Influx/SD samples per 15 min). */
  inEvalDataset: boolean;
  /** Påkrevd for uMeas — steg droppes uten disse. */
  inUMeasRequired?: boolean;
  /** Vis emulated / demand / mpc-kolonner i sammenligning. */
  policyComparable: boolean;
  /** Kritisk for drift — advarsel i plant-modell. */
  critical?: boolean;
};

type DistrictCircuitId = "tr002" | "tr003";

function buildDistrictDiagnosticSpecs(): ControlSignalSpec360102[] {
  const circuits: Array<{
    id: DistrictCircuitId;
    prefix: string;
    label: string;
  }> = [
    { id: "tr002", prefix: "320.002", label: "TR002 residential" },
    { id: "tr003", prefix: "320.003", label: "TR003 commercial" },
  ];

  const pumpEntries: Array<{
    suffix: string;
    key: string;
    label: string;
    role: ControlSignalRole;
    unit?: string;
  }> = [
    {
      suffix: "JP401_A",
      key: "pump.run",
      label: "District pump run command",
      role: "operational_command",
    },
    {
      suffix: "JP401_2_KOM",
      key: "pump.sequencer.command",
      label: "District pump sequencer command",
      role: "operational_command",
    },
    {
      suffix: "JP401_2_SP",
      key: "pump.stop.setpoint",
      label: "District pump stop setpoint",
      role: "operational_command",
      unit: "°C",
    },
    {
      suffix: "JP402_A",
      key: "pump.secondary.run",
      label: "District secondary pump run command",
      role: "operational_command",
    },
    {
      suffix: "JP402_S",
      key: "pump.secondary.status",
      label: "District secondary pump status",
      role: "plant_measurement",
    },
  ];

  const curveEntries: Array<{
    suffix: string;
    key: string;
    label: string;
  }> = [
    { suffix: "RT402_MAX", key: "comp.max", label: "Compensation curve Y4 anchor" },
    { suffix: "RT402_MIN", key: "comp.min", label: "Compensation curve Y1 anchor" },
    { suffix: "RT402_VKH", key: "comp.x3", label: "Compensation curve X3 anchor" },
    { suffix: "RT402_VKHH", key: "comp.x4", label: "Compensation curve X4 anchor" },
    { suffix: "RT402_VKL", key: "comp.x2", label: "Compensation curve X2 anchor" },
    { suffix: "RT402_VKLL", key: "comp.x1", label: "Compensation curve X1 anchor" },
    { suffix: "RT402_VPKH", key: "comp.y3", label: "Compensation curve Y3 anchor" },
    { suffix: "RT402_VPKL", key: "comp.y2", label: "Compensation curve Y2 anchor" },
    { suffix: "RT402_SPF", key: "comp.spf", label: "Compensation curve setpoint bias" },
  ];

  const specs: ControlSignalSpec360102[] = [];

  for (const circuit of circuits) {
    for (const entry of pumpEntries) {
      specs.push({
        canonicalId: `district.${circuit.id}.${entry.key}`,
        label: `${circuit.label} — ${entry.label}`,
        subsystem: "district_heating",
        kind: entry.role === "plant_measurement" ? "measured_state" : "control",
        controlRole: entry.role,
        unit: entry.unit ?? "",
        influxPatterns: [`${circuit.prefix}${entry.suffix}`],
        equipmentTagPatterns: [`${circuit.prefix}${entry.suffix}`],
        inEvalDataset: false,
        policyComparable: false,
      });
    }

    for (const entry of curveEntries) {
      specs.push({
        canonicalId: `district.${circuit.id}.${entry.key}`,
        label: `${circuit.label} — ${entry.label}`,
        subsystem: "district_heating",
        kind: "derived_state",
        controlRole: "bms_configuration",
        unit: "°C",
        influxPatterns: [`${circuit.prefix}${entry.suffix}`],
        equipmentTagPatterns: [`${circuit.prefix}${entry.suffix}`],
        inEvalDataset: false,
        policyComparable: false,
      });
    }
  }

  return specs;
}

/** Én sannhetskilde per signal — katalog, eval, replay og UI leser herfra. */
export const CONTROL_SIGNAL_SPECS_360102: readonly ControlSignalSpec360102[] = [
  {
    canonicalId: "supply.setpoint",
    label: "Settpunkt tilluft (operatør)",
    subsystem: "ventilation",
    kind: "control",
    controlRole: "bms_setpoint",
    unit: "°C",
    influxPatterns: ["SupplySetpoint", "360102_RT401_SP"],
    equipmentTagPatterns: ["360102_RT401_SP"],
    inEvalDataset: true,
    policyComparable: false,
    critical: true,
  },
  {
    canonicalId: "supply.setpoint_calculated",
    label: "Kalkulert settpunkt tilluft (aktiv SP)",
    subsystem: "ventilation",
    kind: "derived_state",
    controlRole: "bms_setpoint",
    unit: "°C",
    uVectorField: "supplySetpointC",
    influxPatterns: ["SupplyPID_SetP", "360102_RT401_SPK"],
    equipmentTagPatterns: ["360102_RT401_SPK"],
    inEvalDataset: true,
    inUMeasRequired: true,
    policyComparable: true,
    critical: true,
  },
  {
    canonicalId: "extract.setpoint",
    label: "Settpunkt avtrekk",
    subsystem: "ventilation",
    kind: "control",
    controlRole: "bms_setpoint",
    unit: "°C",
    influxPatterns: ["ExtractSetpoint", "360102_RT501_SP"],
    equipmentTagPatterns: ["360102_RT501_SP"],
    inEvalDataset: true,
    policyComparable: false,
    critical: true,
  },
  {
    canonicalId: "supply.temp",
    label: "Temp. tilluft",
    subsystem: "temperature",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "°C",
    influxPatterns: ["AI_SupplyAirTemp", "360102_RT401_PV"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "extract.temp",
    label: "Temp. avtrekk (komfortproxy)",
    subsystem: "temperature",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "°C",
    influxPatterns: ["AI_ExtractAirTemp", "360102_RT501_PV"],
    inEvalDataset: true,
    policyComparable: false,
    critical: true,
  },
  {
    canonicalId: "intake.temp",
    label: "Temp. inntak (AHU)",
    subsystem: "temperature",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "°C",
    influxPatterns: ["AI_IntakeAirTemp", "360102_RT901_MV"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "outdoor.temp",
    label: "Utetemperatur (BMS fasade)",
    subsystem: "temperature",
    kind: "disturbance",
    controlRole: "disturbance",
    unit: "°C",
    influxPatterns: ["320.001RT901_MV", "Utetemperatur"],
    equipmentTagPatterns: ["320.001RT901_MV"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "heating.coil_temp",
    label: "Temp. frost varmebatteri",
    subsystem: "heating",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "°C",
    influxPatterns: ["AI_FrostprotTemp1", "360102_RT550_MV"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "heat_recovery.after_temp",
    label: "Temp. etter gjenvinner",
    subsystem: "ventilation",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "°C",
    influxPatterns: ["AI_EfficiencyTemp", "360102_RT402_MV"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "supply.fan.command",
    label: "Pådrag tilluftsvifte",
    subsystem: "ventilation",
    kind: "control",
    controlRole: "mpc_actuator",
    unit: "%",
    uVectorField: "supplyFanPct",
    influxPatterns: ["AO_SAF", "360102_JV401_C"],
    inEvalDataset: true,
    inUMeasRequired: true,
    policyComparable: true,
    critical: true,
  },
  {
    canonicalId: "exhaust.fan.command",
    label: "Pådrag avtrekksvifte",
    subsystem: "ventilation",
    kind: "control",
    controlRole: "mpc_actuator",
    unit: "%",
    uVectorField: "exhaustFanPct",
    influxPatterns: ["AO_EAF", "360102_JV501_C"],
    inEvalDataset: true,
    inUMeasRequired: true,
    policyComparable: true,
    critical: true,
  },
  {
    canonicalId: "supply.fan.flow",
    label: "Luftmengde tilluft",
    subsystem: "ventilation",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "m³/h",
    influxPatterns: ["AI_SAFFlow", "360102_JV401_KV"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "supply.fan.pressure",
    label: "Trykk tilluftskanal",
    subsystem: "ventilation",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "Pa",
    influxPatterns: ["AI_SAFPressure", "360102_JV401_PV"],
    inEvalDataset: false,
    policyComparable: false,
    expectedMissing: true,
  },
  {
    canonicalId: "exhaust.fan.flow",
    label: "Luftmengde avtrekk",
    subsystem: "ventilation",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "m³/h",
    influxPatterns: ["AI_EAFFlow", "360102_JV501_KV"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "exhaust.fan.pressure",
    label: "Trykk avtrekkskanal",
    subsystem: "ventilation",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "Pa",
    influxPatterns: ["AI_EAFPressure", "360102_JV501_PV"],
    inEvalDataset: false,
    policyComparable: false,
    expectedMissing: true,
  },
  {
    canonicalId: "supply.filter.pressure",
    label: "Filtervakt inntak",
    subsystem: "ventilation",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "Pa",
    influxPatterns: ["AI_FilterGuard1", "360102_QD401_PV"],
    inEvalDataset: false,
    policyComparable: false,
  },
  {
    canonicalId: "exhaust.filter.pressure",
    label: "Filtervakt avtrekk",
    subsystem: "ventilation",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "Pa",
    influxPatterns: ["AI_FilterGuard2", "360102_QD501_PV"],
    inEvalDataset: false,
    policyComparable: false,
  },
  {
    canonicalId: "ventilation.sfp",
    label: "Specific Fan Power (SFP)",
    subsystem: "ventilation",
    kind: "derived_state",
    controlRole: "plant_measurement",
    unit: "W/(m³/s)",
    influxPatterns: ["SFP", "360102_SFP"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "supply.fan.mode",
    label: "Driftsmodus tilluft",
    subsystem: "ventilation",
    kind: "control",
    controlRole: "operational_mode",
    unit: "",
    influxPatterns: ["SAFAutoMode", "360102_JV401_KMD"],
    inEvalDataset: false,
    policyComparable: false,
  },
  {
    canonicalId: "exhaust.fan.mode",
    label: "Driftsmodus avtrekk",
    subsystem: "ventilation",
    kind: "control",
    controlRole: "operational_mode",
    unit: "",
    influxPatterns: ["EAFAutoMode", "360102_JV501_KMD"],
    inEvalDataset: false,
    policyComparable: false,
  },
  {
    canonicalId: "heating.valve.command",
    label: "Pådrag varmebatteri",
    subsystem: "heating",
    kind: "control",
    controlRole: "mpc_actuator",
    unit: "%",
    uVectorField: "heatingValvePct",
    influxPatterns: ["AO_3", "360102_SB401_C"],
    inEvalDataset: true,
    inUMeasRequired: true,
    policyComparable: true,
    critical: true,
  },
  {
    canonicalId: "cooling.valve.command",
    label: "Pådrag kjølebatteri (AO)",
    subsystem: "cooling",
    kind: "control",
    controlRole: "mpc_actuator",
    unit: "%",
    uVectorField: "coolingValvePct",
    influxPatterns: ["AO_5", "360102_SB501_C"],
    inEvalDataset: true,
    inUMeasRequired: true,
    policyComparable: true,
    critical: true,
  },
  {
    canonicalId: "cooling.valve.position",
    label: "Posisjon kjølebatteri (feedback)",
    subsystem: "cooling",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "%",
    influxPatterns: ["AO_4", "360102_SB501_C"],
    equipmentTagPatterns: ["360102_SB501_C"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.tr002.valve.command",
    label: "Pådrag varmeventil TR002 bolig",
    subsystem: "district_heating",
    kind: "control",
    controlRole: "district_actuator",
    unit: "%",
    uVectorField: "districtTr002ValvePct",
    influxPatterns: ["320.002SB502_C"],
    equipmentTagPatterns: ["320.002SB502_C"],
    inEvalDataset: true,
    policyComparable: true,
  },
  {
    canonicalId: "district.tr003.valve.command",
    label: "Pådrag varmeventil TR003 næring",
    subsystem: "district_heating",
    kind: "control",
    controlRole: "district_actuator",
    unit: "%",
    uVectorField: "districtTr003ValvePct",
    influxPatterns: ["320.003SB502_C"],
    equipmentTagPatterns: ["320.003SB502_C"],
    inEvalDataset: true,
    policyComparable: true,
  },
  {
    canonicalId: "district.tr002.supply.temp",
    label: "Tur temperatur TR002 bolig",
    subsystem: "district_heating",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "°C",
    influxPatterns: ["320.002RT402_MV"],
    equipmentTagPatterns: ["320.002RT402_MV"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.tr003.supply.temp",
    label: "Tur temperatur TR003 næring",
    subsystem: "district_heating",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "°C",
    influxPatterns: ["320.003RT402_MV"],
    equipmentTagPatterns: ["320.003RT402_MV"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.tr002.return.temp",
    label: "Retur temperatur TR002 bolig",
    subsystem: "district_heating",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "°C",
    influxPatterns: ["320.002RT502_MV"],
    equipmentTagPatterns: ["320.002RT502_MV"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.tr003.return.temp",
    label: "Retur temperatur TR003 næring",
    subsystem: "district_heating",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "°C",
    influxPatterns: ["320.003RT502_MV"],
    equipmentTagPatterns: ["320.003RT502_MV"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.tr002.supply.setpoint",
    label: "Beregnet tur-SP TR002 bolig",
    subsystem: "district_heating",
    kind: "derived_state",
    controlRole: "plant_measurement",
    unit: "°C",
    influxPatterns: ["320.002RT402_SPK"],
    equipmentTagPatterns: ["320.002RT402_SPK"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.tr003.supply.setpoint",
    label: "Beregnet tur-SP TR003 næring",
    subsystem: "district_heating",
    kind: "derived_state",
    controlRole: "plant_measurement",
    unit: "°C",
    influxPatterns: ["320.003RT402_SPK"],
    equipmentTagPatterns: ["320.003RT402_SPK"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.meter.tr002.energy",
    label: "Akkumulert energi TR002 (OE001 bolig)",
    subsystem: "district_heating",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "kWh",
    influxPatterns: ["320001OE001_energi"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.meter.tr002.power",
    label: "Effekt TR002 (OE001 bolig)",
    subsystem: "district_heating",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "kW",
    influxPatterns: ["320001OE001_effekt"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.meter.tr002.supply.temp",
    label: "Tur TR002 primær (OE001 bolig)",
    subsystem: "district_heating",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "°C",
    influxPatterns: ["320001OE001_turtemp"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.meter.tr002.return.temp",
    label: "Retur TR002 primær (OE001 bolig)",
    subsystem: "district_heating",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "°C",
    influxPatterns: ["320001OE001_returtemp"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.meter.tr003.energy",
    label: "Akkumulert energi TR003 (OE001 næring)",
    subsystem: "district_heating",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "kWh",
    influxPatterns: ["320003OE001_energi"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.meter.tr003.power",
    label: "Effekt TR003 (OE001 næring)",
    subsystem: "district_heating",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "kW",
    influxPatterns: ["320003OE001_effekt"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.meter.tr003.supply.temp",
    label: "Tur TR003 primær (OE001 næring)",
    subsystem: "district_heating",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "°C",
    influxPatterns: ["320003OE001_turtemp"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.meter.tr003.return.temp",
    label: "Retur TR003 primær (OE001 næring)",
    subsystem: "district_heating",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "°C",
    influxPatterns: ["320003OE001_returtemp"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.tr002.pump.status",
    label: "Pumpestatus TR002 bolig (observert)",
    subsystem: "district_heating",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "",
    influxPatterns: ["320.002JP401_S"],
    equipmentTagPatterns: ["320.002JP401_S"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "district.tr003.pump.status",
    label: "Pumpestatus TR003 næring (observert)",
    subsystem: "district_heating",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "",
    influxPatterns: ["320.003JP401_S"],
    equipmentTagPatterns: ["320.003JP401_S"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "heat_recovery.efficiency",
    label: "Virkningsgrad gjenvinner",
    subsystem: "ventilation",
    kind: "derived_state",
    controlRole: "plant_measurement",
    unit: "%",
    influxPatterns: ["Efficiency", "360102_LX471_KV"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "heat_recovery.command",
    label: "Pådrag gjenvinner",
    subsystem: "ventilation",
    kind: "control",
    controlRole: "operational_mode",
    unit: "%",
    influxPatterns: ["360102_LX471_C", "LX471_C"],
    inEvalDataset: false,
    policyComparable: false,
    expectedMissing: true,
  },
  {
    canonicalId: "system.mode",
    label: "Systemstatus / anleggsmodus",
    subsystem: "system",
    kind: "control",
    controlRole: "operational_mode",
    unit: "",
    influxPatterns: ["UnitMode", "360102_Plantmode_KV"],
    equipmentTagPatterns: ["360102_Plantmode_KV"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "system.schedule",
    label: "Tidsprogram / driftsmodus",
    subsystem: "system",
    kind: "control",
    controlRole: "operational_mode",
    unit: "",
    influxPatterns: ["AirUnitAutoMode", "360102_KMD_MSV", "360102_UR"],
    equipmentTagPatterns: ["360102_UR", "360102_FORLENGET DRIFT"],
    inEvalDataset: false,
    policyComparable: false,
  },
  {
    canonicalId: "constraint.frost",
    label: "Frostvakt",
    subsystem: "system",
    kind: "constraint",
    controlRole: "constraint",
    unit: "",
    influxPatterns: ["Frostrisk", "360102_FROST"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "constraint.fire",
    label: "Brannalarm",
    subsystem: "system",
    kind: "constraint",
    controlRole: "constraint",
    unit: "",
    influxPatterns: ["Firealarm", "360102_BRANNALARM"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "constraint.low_efficiency",
    label: "Lav virkningsgrad gjenvinner",
    subsystem: "ventilation",
    kind: "constraint",
    controlRole: "constraint",
    unit: "",
    influxPatterns: ["Lowefficiency"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "heat_recovery.rotation_guard",
    label: "Rotasjonsvakt gjenvinner",
    subsystem: "ventilation",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "",
    influxPatterns: ["Rotationguardexchanger"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "heating.pump.malfunction",
    label: "Alarm pumpe varmebatteri",
    subsystem: "heating",
    kind: "constraint",
    controlRole: "constraint",
    unit: "",
    influxPatterns: ["Malf_pumpheater", "360102_JP401_A"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "cooling.pump.malfunction",
    label: "Alarm pumpe kjølebatteri",
    subsystem: "cooling",
    kind: "constraint",
    controlRole: "constraint",
    unit: "",
    influxPatterns: ["Malf_pumpcooler", "360102_JP501_A"],
    inEvalDataset: true,
    policyComparable: false,
  },
  {
    canonicalId: "supply.damper.status",
    label: "Spjeld inntak (status)",
    subsystem: "ventilation",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "",
    influxPatterns: ["360102_KA401_S"],
    inEvalDataset: false,
    policyComparable: false,
    expectedMissing: true,
  },
  {
    canonicalId: "exhaust.damper.status",
    label: "Spjeld avkast (status)",
    subsystem: "ventilation",
    kind: "measured_state",
    controlRole: "plant_measurement",
    unit: "",
    influxPatterns: ["360102_KA501_S"],
    inEvalDataset: false,
    policyComparable: false,
    expectedMissing: true,
  },
  ...buildDistrictDiagnosticSpecs(),
] as const;

export const CONTROL_SIGNAL_CATALOG_360102: readonly ControlCatalogEntry[] =
  CONTROL_SIGNAL_SPECS_360102.map(
    ({ canonicalId, label, kind, subsystem, influxPatterns, equipmentTagPatterns, expectedMissing }) => ({
      canonicalId,
      label,
      kind,
      subsystem,
      influxPatterns,
      equipmentTagPatterns,
      expectedMissing,
    }),
  );

export const CONTROL_SIGNAL_SPEC_BY_ID = new Map(
  CONTROL_SIGNAL_SPECS_360102.map((spec) => [spec.canonicalId, spec]),
);

export function specForCanonical(canonicalId: string): ControlSignalSpec360102 | undefined {
  return CONTROL_SIGNAL_SPEC_BY_ID.get(canonicalId);
}

export const MPC_EVAL_DATASET_CANONICALS = CONTROL_SIGNAL_SPECS_360102.filter(
  (s) => s.inEvalDataset,
).map((s) => s.canonicalId);

export const MPC_U_MEAS_CANONICALS = CONTROL_SIGNAL_SPECS_360102.filter(
  (s) => s.inUMeasRequired,
).map((s) => s.canonicalId);

export const MPC_CONTROL_CANONICALS = CONTROL_SIGNAL_SPECS_360102.filter(
  (s) =>
    s.controlRole === "mpc_actuator" ||
    s.controlRole === "district_actuator" ||
    s.controlRole === "bms_setpoint" ||
    s.canonicalId === "extract.temp",
).map((s) => s.canonicalId);

export const MPC_PLANT_OBSERVATION_CANONICALS = [
  "supply.temp",
  "intake.temp",
  "extract.setpoint",
  "extract.temp",
  "heat_recovery.after_temp",
] as const;

/** Plantmålinger i eval utover kjerne-grafene. */
export const MPC_EVAL_EXTRA_PLANT_CANONICALS = [
  "heating.coil_temp",
  "supply.fan.flow",
  "exhaust.fan.flow",
  "heat_recovery.efficiency",
  "cooling.valve.position",
  "ventilation.sfp",
  "system.mode",
  "heat_recovery.rotation_guard",
  "heating.pump.malfunction",
  "cooling.pump.malfunction",
] as const;

/** Fjernvarme TR002/TR003 — eval, u_k og kretssnitt mot BHCC. */
export const MPC_EVAL_DISTRICT_CANONICALS = [
  "district.tr002.valve.command",
  "district.tr003.valve.command",
  "district.tr002.supply.temp",
  "district.tr003.supply.temp",
  "district.tr002.return.temp",
  "district.tr003.return.temp",
  "district.tr002.supply.setpoint",
  "district.tr003.supply.setpoint",
  "district.meter.tr002.energy",
  "district.meter.tr002.power",
  "district.meter.tr002.supply.temp",
  "district.meter.tr002.return.temp",
  "district.meter.tr003.energy",
  "district.meter.tr003.power",
  "district.meter.tr003.supply.temp",
  "district.meter.tr003.return.temp",
  "district.tr002.pump.status",
  "district.tr003.pump.status",
] as const;

export const MPC_DISTURBANCE_CANONICALS = CONTROL_SIGNAL_SPECS_360102.filter(
  (s) => s.controlRole === "disturbance",
).map((s) => s.canonicalId);

export const MPC_CONSTRAINT_CANONICALS = CONTROL_SIGNAL_SPECS_360102.filter(
  (s) => s.controlRole === "constraint",
).map((s) => s.canonicalId);

export type EvalTimestepPlantAccumulator = {
  sampleValues: {
    supplySetpointC?: number;
    supplySetpointCalcC?: number;
    supplyFanPct?: number;
    exhaustFanPct?: number;
    heatingValvePct?: number;
    coolingValveCommandPct?: number;
    coolingValveFeedbackPct?: number;
    districtTr002ValvePct?: number;
    districtTr003ValvePct?: number;
    outdoorTempC?: number | null;
  };
  extractTempC?: number;
  supplyTempMeasC?: number;
  intakeTempMeasC?: number;
  extractSetpointC?: number;
  heatRecoveryAfterTempC?: number;
  outdoorTempBmsSample?: number;
  supplyFanFlowM3h?: number;
  exhaustFanFlowM3h?: number;
  heatingCoilTempC?: number;
  heatRecoveryEfficiencyPct?: number;
  frostRiskRaw?: number;
  fireAlarmRaw?: number;
  lowEfficiencyRaw?: number;
  districtTr002ValvePct?: number;
  districtTr003ValvePct?: number;
  districtTr002SupplyTempC?: number;
  districtTr003SupplyTempC?: number;
  districtTr002ReturnTempC?: number;
  districtTr003ReturnTempC?: number;
  districtTr002SupplySetpointC?: number;
  districtTr003SupplySetpointC?: number;
  districtMeterTr002EnergyKwh?: number;
  districtMeterTr002PowerKw?: number;
  districtMeterTr002SupplyTempC?: number;
  districtMeterTr002ReturnTempC?: number;
  districtMeterTr003EnergyKwh?: number;
  districtMeterTr003PowerKw?: number;
  districtMeterTr003SupplyTempC?: number;
  districtMeterTr003ReturnTempC?: number;
  districtTr002PumpObserved?: boolean;
  districtTr003PumpObserved?: boolean;
  ventilationSfp?: number;
  systemPlantMode?: number;
  heatRecoveryRotationGuardRaw?: number;
  pumpHeatingMalfunctionRaw?: number;
  pumpCoolingMalfunctionRaw?: number;
};

/** Kartlegger canonical → eval-felter (én vei inn i load-eval-dataset). */
export function applyEvalSampleToAccumulator(
  canonicalId: string,
  value: number,
  acc: EvalTimestepPlantAccumulator,
): void {
  switch (canonicalId) {
    case "supply.setpoint":
      acc.sampleValues.supplySetpointC = value;
      break;
    case "supply.setpoint_calculated":
      acc.sampleValues.supplySetpointCalcC = value;
      break;
    case "supply.fan.command":
      acc.sampleValues.supplyFanPct = value;
      break;
    case "exhaust.fan.command":
      acc.sampleValues.exhaustFanPct = value;
      break;
    case "heating.valve.command":
      acc.sampleValues.heatingValvePct = value;
      break;
    case "district.tr002.valve.command":
      acc.sampleValues.districtTr002ValvePct = value;
      acc.districtTr002ValvePct = value;
      break;
    case "district.tr003.valve.command":
      acc.sampleValues.districtTr003ValvePct = value;
      acc.districtTr003ValvePct = value;
      break;
    case "extract.temp":
      acc.extractTempC = value;
      break;
    case "supply.temp":
      acc.supplyTempMeasC = value;
      break;
    case "intake.temp":
      acc.intakeTempMeasC = value;
      break;
    case "extract.setpoint":
      acc.extractSetpointC = value;
      break;
    case "heat_recovery.after_temp":
      acc.heatRecoveryAfterTempC = value;
      break;
    case "outdoor.temp":
      acc.outdoorTempBmsSample = value;
      break;
    case "heating.coil_temp":
      acc.heatingCoilTempC = value;
      break;
    case "supply.fan.flow":
      acc.supplyFanFlowM3h = value;
      break;
    case "exhaust.fan.flow":
      acc.exhaustFanFlowM3h = value;
      break;
    case "heat_recovery.efficiency":
      acc.heatRecoveryEfficiencyPct = value;
      break;
    case "constraint.frost":
      acc.frostRiskRaw = value;
      break;
    case "constraint.fire":
      acc.fireAlarmRaw = value;
      break;
    case "constraint.low_efficiency":
      acc.lowEfficiencyRaw = value;
      break;
    case "district.tr002.supply.temp":
      acc.districtTr002SupplyTempC = value;
      break;
    case "district.tr003.supply.temp":
      acc.districtTr003SupplyTempC = value;
      break;
    case "district.tr002.return.temp":
      acc.districtTr002ReturnTempC = value;
      break;
    case "district.tr003.return.temp":
      acc.districtTr003ReturnTempC = value;
      break;
    case "district.tr002.supply.setpoint":
      acc.districtTr002SupplySetpointC = value;
      break;
    case "district.tr003.supply.setpoint":
      acc.districtTr003SupplySetpointC = value;
      break;
    case "district.meter.tr002.energy":
      acc.districtMeterTr002EnergyKwh = value;
      break;
    case "district.meter.tr002.power":
      acc.districtMeterTr002PowerKw = value;
      break;
    case "district.meter.tr002.supply.temp":
      acc.districtMeterTr002SupplyTempC = value;
      break;
    case "district.meter.tr002.return.temp":
      acc.districtMeterTr002ReturnTempC = value;
      break;
    case "district.meter.tr003.energy":
      acc.districtMeterTr003EnergyKwh = value;
      break;
    case "district.meter.tr003.power":
      acc.districtMeterTr003PowerKw = value;
      break;
    case "district.meter.tr003.supply.temp":
      acc.districtMeterTr003SupplyTempC = value;
      break;
    case "district.meter.tr003.return.temp":
      acc.districtMeterTr003ReturnTempC = value;
      break;
    case "district.tr002.pump.status":
      acc.districtTr002PumpObserved = value > 0;
      break;
    case "district.tr003.pump.status":
      acc.districtTr003PumpObserved = value > 0;
      break;
    case "ventilation.sfp":
      acc.ventilationSfp = value;
      break;
    case "system.mode":
      acc.systemPlantMode = value;
      break;
    case "heat_recovery.rotation_guard":
      acc.heatRecoveryRotationGuardRaw = value;
      break;
    case "heating.pump.malfunction":
      acc.pumpHeatingMalfunctionRaw = value;
      break;
    case "cooling.pump.malfunction":
      acc.pumpCoolingMalfunctionRaw = value;
      break;
    default:
      break;
  }
}

function pickVector(
  vector: MpcControlVector | null | undefined,
  field: keyof MpcControlVector,
): number | null {
  const v = vector?.[field];
  return v != null && Number.isFinite(v) ? v : null;
}

export type ReplayPolicyColumn = "observed" | "emulated" | "demand" | "mpc";

/** Observert verdi per canonical fra replay-steg. */
export function pickObservedReplayValue(
  step: MpcReplayStep,
  spec: ControlSignalSpec360102,
): number | null {
  if (spec.uVectorField && spec.controlRole === "mpc_actuator") {
    return pickVector(step.uBmsMeas, spec.uVectorField);
  }
  if (spec.uVectorField && spec.controlRole === "district_actuator") {
    return pickVector(step.uBmsMeas, spec.uVectorField);
  }

  switch (spec.canonicalId) {
    case "supply.setpoint":
      return step.supplySetpointOperatorC ?? null;
    case "supply.setpoint_calculated":
      return step.supplySetpointCalcC ?? step.uBmsMeas?.supplySetpointC ?? null;
    case "extract.setpoint":
      return step.extractSetpointC ?? null;
    case "supply.temp":
      return step.supplyTempMeasC ?? null;
    case "extract.temp":
      return step.extractTempMeasC ?? null;
    case "intake.temp":
      return step.intakeTempMeasC ?? null;
    case "heat_recovery.after_temp":
      return step.heatRecoveryAfterTempC ?? null;
    case "outdoor.temp":
      return step.outdoorTempBmsC ?? step.outdoorTempC ?? null;
    case "cooling.valve.command":
      return step.coolingValveCommandPct ?? step.uBmsMeas?.coolingValvePct ?? null;
    case "cooling.valve.position":
      return step.coolingValveFeedbackPct ?? null;
    case "heating.coil_temp":
      return step.heatingCoilTempC ?? null;
    case "supply.fan.flow":
      return step.supplyFanFlowM3h ?? null;
    case "exhaust.fan.flow":
      return step.exhaustFanFlowM3h ?? null;
    case "heat_recovery.efficiency":
      return step.heatRecoveryEfficiencyPct ?? null;
    case "constraint.frost":
      return step.frostRiskActive ? 1 : step.frostRiskActive === false ? 0 : null;
    case "constraint.fire":
      return step.fireAlarmActive ? 1 : step.fireAlarmActive === false ? 0 : null;
    case "constraint.low_efficiency":
      return step.lowEfficiencyActive
        ? 1
        : step.lowEfficiencyActive === false
          ? 0
          : null;
    case "district.tr002.valve.command":
      return step.districtTr002ValvePct ?? null;
    case "district.tr003.valve.command":
      return step.districtTr003ValvePct ?? null;
    case "district.tr002.supply.temp":
      return step.districtTr002SupplyTempC ?? null;
    case "district.tr003.supply.temp":
      return step.districtTr003SupplyTempC ?? null;
    case "district.tr002.return.temp":
      return step.districtTr002ReturnTempC ?? null;
    case "district.tr003.return.temp":
      return step.districtTr003ReturnTempC ?? null;
    case "district.tr002.supply.setpoint":
      return step.districtTr002SupplySetpointC ?? null;
    case "district.tr003.supply.setpoint":
      return step.districtTr003SupplySetpointC ?? null;
    case "district.meter.tr002.energy":
      return step.districtMeterTr002EnergyKwh ?? null;
    case "district.meter.tr002.power":
      return step.districtMeterTr002PowerKw ?? null;
    case "district.meter.tr002.supply.temp":
      return step.districtMeterTr002SupplyTempC ?? null;
    case "district.meter.tr002.return.temp":
      return step.districtMeterTr002ReturnTempC ?? null;
    case "district.meter.tr003.energy":
      return step.districtMeterTr003EnergyKwh ?? null;
    case "district.meter.tr003.power":
      return step.districtMeterTr003PowerKw ?? null;
    case "district.meter.tr003.supply.temp":
      return step.districtMeterTr003SupplyTempC ?? null;
    case "district.meter.tr003.return.temp":
      return step.districtMeterTr003ReturnTempC ?? null;
    case "district.tr002.pump.status":
      return step.districtTr002PumpObserved == null
        ? null
        : step.districtTr002PumpObserved
          ? 1
          : 0;
    case "district.tr003.pump.status":
      return step.districtTr003PumpObserved == null
        ? null
        : step.districtTr003PumpObserved
          ? 1
          : 0;
    case "ventilation.sfp":
      return step.ventilationSfp ?? null;
    case "system.mode":
      return step.systemPlantMode ?? null;
    case "heat_recovery.rotation_guard":
      return step.heatRecoveryRotationGuardRaw ?? null;
    case "heating.pump.malfunction":
      return step.pumpHeatingMalfunctionActive == null
        ? null
        : step.pumpHeatingMalfunctionActive
          ? 1
          : 0;
    case "cooling.pump.malfunction":
      return step.pumpCoolingMalfunctionActive == null
        ? null
        : step.pumpCoolingMalfunctionActive
          ? 1
          : 0;
    default:
      if (spec.uVectorField) {
        return pickVector(step.uBmsMeas, spec.uVectorField);
      }
      return null;
  }
}

export function pickPolicyReplayValue(
  step: MpcReplayStep,
  spec: ControlSignalSpec360102,
  policy: Exclude<ReplayPolicyColumn, "observed">,
): number | null {
  if (!spec.policyComparable || !spec.uVectorField) {
    if (spec.canonicalId === "supply.setpoint_calculated") {
      return step.supplySetpointCalcC ?? null;
    }
    if (spec.canonicalId === "extract.setpoint") {
      return step.extractSetpointC ?? null;
    }
    return null;
  }

  const vector =
    policy === "emulated"
      ? step.uBmsSim
      : policy === "demand"
        ? step.uDemand
        : step.uMpc;
  return pickVector(vector, spec.uVectorField);
}

export function missingCriticalSignalLabelsFromSpecs(
  resolvedCanonicalIds: ReadonlySet<string>,
): string[] {
  return CONTROL_SIGNAL_SPECS_360102.filter(
    (s) => s.critical && !resolvedCanonicalIds.has(s.canonicalId),
  ).map((s) => s.label);
}

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

export const CONTROL_KIND_LABELS: Record<ControlSignalKind, string> = {
  control: "Styring",
  measured_state: "Måling",
  derived_state: "Avledet",
  disturbance: "Forstyrrelse",
  constraint: "Begrensning",
  objective: "Mål",
};

export const CONTROL_SUBSYSTEM_LABELS: Record<ControlSubsystem, string> = {
  ventilation: "Ventilasjon",
  heating: "Varme",
  cooling: "Kjøling",
  district_heating: "Fjernvarme (TR)",
  temperature: "Temperatur",
  energy: "Energi",
  system: "Drift og begrensninger",
};
