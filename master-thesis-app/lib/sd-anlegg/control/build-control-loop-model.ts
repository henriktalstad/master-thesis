import { formatInfraspawnUnit } from "@/lib/infraspawn/format-unit";
import type {
  ControlLoopDiagram,
  ControlLoopEdge,
  ControlLoopNode,
  ControlPlantModel,
  ResolvedControlSignal,
} from "./control-types";

function indexControlSignals(
  model: ControlPlantModel,
): Map<string, ResolvedControlSignal> {
  const index = new Map<string, ResolvedControlSignal>();
  for (const subsystem of model.subsystems) {
    for (const signal of [
      ...subsystem.controls,
      ...subsystem.states,
      ...subsystem.constraints,
    ]) {
      index.set(signal.catalog.canonicalId, signal);
    }
  }
  return index;
}

function findSignal(
  index: Map<string, ResolvedControlSignal>,
  canonicalId: string,
): ResolvedControlSignal | undefined {
  return index.get(canonicalId);
}

function formatLiveValue(
  signal: ResolvedControlSignal | undefined,
): { text: string | null; available: boolean } {
  if (!signal) return { text: null, available: false };
  if (signal.lastValue == null) {
    return {
      text: signal.availability === "expected_missing" ? "Forv. hull" : "—",
      available: signal.availability === "available",
    };
  }
  const unitLabel = formatInfraspawnUnit(signal.point?.unit?.trim());
  const rounded =
    Math.abs(signal.lastValue) >= 100
      ? Math.round(signal.lastValue)
      : Math.round(signal.lastValue * 10) / 10;
  return {
    text: unitLabel ? `${rounded} ${unitLabel}` : String(rounded),
    available: signal.availability === "available",
  };
}

function node(
  id: string,
  label: string,
  role: ControlLoopNode["role"],
  signal: ResolvedControlSignal | undefined,
  x: number,
  y: number,
): ControlLoopNode {
  const live = formatLiveValue(signal);
  return {
    id,
    label,
    role,
    canonicalId: signal?.catalog.canonicalId,
    value: live.text,
    available: live.available,
    x,
    y,
  };
}

function edge(from: string, to: string, label?: string, dashed = false): ControlLoopEdge {
  return { from, to, label, dashed };
}

export function buildControlLoopDiagram(
  plantModel: ControlPlantModel,
): ControlLoopDiagram {
  const signals = indexControlSignals(plantModel);

  const nodes: ControlLoopNode[] = [
    {
      id: "outdoor",
      label: "Utetemperatur",
      role: "disturbance",
      value: "MET-prognose",
      available: true,
      x: 56,
      y: 38,
    },
    node(
      "supply_sp",
      "SP tilluft",
      "setpoint",
      findSignal(signals, "supply.setpoint"),
      184,
      38,
    ),
    node(
      "supply_sp_calc",
      "Kalk. SP",
      "setpoint",
      findSignal(signals, "supply.setpoint_calculated"),
      316,
      38,
    ),
    node(
      "heating_valve",
      "Varmebatteri",
      "actuator",
      findSignal(signals, "heating.valve.command"),
      448,
      38,
    ),
    node(
      "supply_fan",
      "Tilluftvifte",
      "actuator",
      findSignal(signals, "supply.fan.command"),
      580,
      38,
    ),
    node(
      "supply_temp",
      "Temp. tilluft",
      "sensor",
      findSignal(signals, "supply.temp"),
      712,
      38,
    ),
    node(
      "extract_sp",
      "SP avtrekk",
      "setpoint",
      findSignal(signals, "extract.setpoint"),
      184,
      172,
    ),
    node(
      "extract_temp",
      "Temp. avtrekk",
      "sensor",
      findSignal(signals, "extract.temp"),
      712,
      172,
    ),
    node(
      "exhaust_fan",
      "Avtrekkvifte",
      "actuator",
      findSignal(signals, "exhaust.fan.command"),
      580,
      172,
    ),
    {
      id: "simulatedMpc",
      label: "Simulert MPC",
      role: "simulatedMpc",
      value: "Δ pådrag",
      available: true,
      x: 848,
      y: 105,
    },
    {
      id: "energy",
      label: "El + fjernvarme",
      role: "plant",
      value: "Bygg (BHCC)",
      available: true,
      x: 968,
      y: 105,
    },
  ];

  const edges: ControlLoopEdge[] = [
    edge("outdoor", "heating_valve", "last"),
    edge("supply_sp", "heating_valve"),
    edge("supply_sp_calc", "heating_valve", "lokal reg.", true),
    edge("heating_valve", "supply_temp"),
    edge("supply_fan", "supply_temp", "luftmengde"),
    edge("supply_temp", "extract_temp", "rom"),
    edge("extract_sp", "extract_temp", "regulering", true),
    edge("exhaust_fan", "extract_temp", "luftmengde"),
    edge("simulatedMpc", "supply_sp", "ΔSP", true),
    edge("simulatedMpc", "supply_fan", "Δ%", true),
    edge("simulatedMpc", "heating_valve", "Δ%", true),
    edge("supply_fan", "energy"),
    edge("heating_valve", "energy"),
  ];

  return {
    unitKey: plantModel.unitKey,
    nodes,
    edges,
  };
}
