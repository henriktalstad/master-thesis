import { describe, expect, it } from "bun:test";
import {
  CONTROL_SIGNAL_SPECS_360102,
  MPC_EVAL_DATASET_CANONICALS,
  MPC_EVAL_DISTRICT_CANONICALS,
  MPC_U_MEAS_CANONICALS,
  pickObservedReplayValue,
} from "@/lib/sd-anlegg/control/control-signal-registry-360102";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

describe("control-signal-registry-360102", () => {
  it("har unike canonicalId", () => {
    const ids = CONTROL_SIGNAL_SPECS_360102.map((s) => s.canonicalId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("mpc_actuator har uVectorField og policyComparable", () => {
    for (const spec of CONTROL_SIGNAL_SPECS_360102) {
      if (spec.controlRole !== "mpc_actuator") continue;
      expect(spec.uVectorField, spec.canonicalId).toBeDefined();
      expect(spec.policyComparable, spec.canonicalId).toBe(true);
    }
  });

  it("uMeas-required inkluderer kjølebatteri", () => {
    expect(MPC_U_MEAS_CANONICALS).toContain("cooling.valve.command");
  });

  it("uMeas-required inkluderer aktiv tilluft-SP", () => {
    expect(MPC_U_MEAS_CANONICALS).toContain("supply.setpoint_calculated");
  });

  it("uMeas-required er subset av eval-dataset", () => {
    for (const id of MPC_U_MEAS_CANONICALS) {
      expect(MPC_EVAL_DATASET_CANONICALS).toContain(id);
    }
  });

  it("district_actuator er i eval men ikke uMeas", () => {
    for (const id of MPC_EVAL_DISTRICT_CANONICALS) {
      expect(MPC_EVAL_DATASET_CANONICALS).toContain(id);
      expect(MPC_U_MEAS_CANONICALS).not.toContain(id);
    }
    const valves = CONTROL_SIGNAL_SPECS_360102.filter(
      (s) => s.controlRole === "district_actuator",
    );
    expect(valves).toHaveLength(2);
    for (const spec of valves) {
      expect(spec.uVectorField, spec.canonicalId).toBeDefined();
      expect(spec.policyComparable, spec.canonicalId).toBe(true);
    }
  });

  it("plukker observert TR003-ventil fra replay-steg", () => {
    const spec = CONTROL_SIGNAL_SPECS_360102.find(
      (s) => s.canonicalId === "district.tr003.valve.command",
    )!;
    const step = {
      districtTr003ValvePct: 42,
      uBmsMeas: {
        supplySetpointC: 18,
        supplyFanPct: 40,
        exhaustFanPct: 35,
        heatingValvePct: 0,
        coolingValvePct: 0,
        districtTr002ValvePct: 0,
        districtTr003ValvePct: 42,
      },
    } as MpcReplayStep;
    expect(pickObservedReplayValue(step, spec)).toBe(42);
  });

  it("skiller operatør-SP og aktiv calc-SP i observert replay", () => {
    const step = {
      supplySetpointOperatorC: 17,
      supplySetpointCalcC: 18.2,
      uBmsMeas: {
        supplySetpointC: 18.2,
        supplyFanPct: 40,
        exhaustFanPct: 35,
        heatingValvePct: 0,
        coolingValvePct: 0,
      },
    } as MpcReplayStep;

    const operator = CONTROL_SIGNAL_SPECS_360102.find(
      (s) => s.canonicalId === "supply.setpoint",
    )!;
    const calc = CONTROL_SIGNAL_SPECS_360102.find(
      (s) => s.canonicalId === "supply.setpoint_calculated",
    )!;

    expect(pickObservedReplayValue(step, operator)).toBe(17);
    expect(pickObservedReplayValue(step, calc)).toBe(18.2);
  });
});
