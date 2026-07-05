import { describe, expect, test } from "bun:test";
import { buildMpcSignalComparison } from "@/lib/sd-anlegg/control/build-mpc-signal-comparison";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function makeStep(
  hour: number,
  observedSp: number,
  mpcSp: number,
): MpcReplayStep {
  const d = new Date(Date.UTC(2026, 5, 25, hour, 30, 0, 0));
  return {
    t: d.toISOString(),
    uBmsMeas: {
      supplySetpointC: observedSp,
      supplyFanPct: 40,
      exhaustFanPct: 38,
      heatingValvePct: 10,
      coolingValvePct: 0,
    },
    uBmsSim: {
      supplySetpointC: observedSp - 0.2,
      supplyFanPct: 40,
      exhaustFanPct: 38,
      heatingValvePct: 10,
      coolingValvePct: 0,
    },
    uMpc: {
      supplySetpointC: mpcSp,
      supplyFanPct: 35,
      exhaustFanPct: 33,
      heatingValvePct: 8,
      coolingValvePct: 0,
    },
    deltaU: {
      supplySetpointC: null,
      supplyFanPct: null,
      exhaustFanPct: null,
      heatingValvePct: null,
      coolingValvePct: null,
    },
    extractTempMeasC: 22,
    extractTempPredC: 21.8,
    electricKw: 0.5,
    heatKw: 0.2,
    marginalKrPerKwh: 1.1,
    outdoorTempC: null,
    comfortViolation: false,
    usedFallback: false,
  };
}

describe("buildMpcSignalComparison", () => {
  test("bygger tre-spors serie for settpunkt", () => {
    const comparison = buildMpcSignalComparison([
      makeStep(10, 18, 17.5),
      makeStep(10, 18, 17.5),
      makeStep(11, 19, 18.2),
    ]);

    expect(comparison.series.length).toBeGreaterThan(0);
    const sp = comparison.series.find((s) => s.id === "supply_setpoint_mpc");
    expect(sp).toBeDefined();
    expect(sp!.points.length).toBe(2);
    expect(sp!.points[0]!.observed).toBe(18);
    expect(sp!.points[0]!.mpc).toBe(17.5);
    expect(sp!.summary.meanAbsErrorObservedVsMpc).not.toBeNull();
  });

  test("skiller operatør-SP og aktiv calc-SP i grafserier", () => {
    const steps = [
      {
        ...makeStep(10, 18.2, 17.5),
        supplySetpointOperatorC: 17,
        supplySetpointCalcC: 18.2,
      },
      {
        ...makeStep(11, 19.1, 18.2),
        supplySetpointOperatorC: 17,
        supplySetpointCalcC: 19.1,
      },
    ];
    const comparison = buildMpcSignalComparison(steps);

    const operator = comparison.series.find((s) => s.id === "supply_setpoint_operator");
    expect(operator).toBeDefined();
    expect(operator!.chartVariant).toBe("observed_with_reference");
    expect(operator!.points[0]!.observed).toBe(17);
    expect(operator!.points[0]!.reference).toBe(18.2);

    const active = comparison.series.find((s) => s.id === "supply_setpoint_mpc");
    expect(active).toBeDefined();
    expect(active!.points[0]!.observed).toBe(18.2);
    expect(active!.points[0]!.mpc).toBe(17.5);
  });

  test("inkluderer kjølebatteri og planttilstand (avtrekk, utetemp Frost vs BMS)", () => {
    const steps = [
      {
        ...makeStep(10, 18, 17.5),
        outdoorTempC: 5.2,
        outdoorTempFrostC: 5.2,
        outdoorTempBmsC: 5.5,
        supplyTempMeasC: 19.1,
        intakeTempMeasC: 4.8,
        extractSetpointC: 22,
        heatRecoveryAfterTempC: 12.3,
      },
    ];
    const comparison = buildMpcSignalComparison(steps);

    expect(comparison.series.some((s) => s.id === "cooling_valve_mpc")).toBe(true);
    expect(comparison.series.some((s) => s.id === "extract_temp_comfort")).toBe(true);
    expect(comparison.series.some((s) => s.id === "outdoor_temp_cross")).toBe(true);

    const outdoor = comparison.series.find((s) => s.id === "outdoor_temp_cross");
    expect(outdoor?.points[0]?.observed).toBe(5.2);
    expect(outdoor?.points[0]?.emulated).toBe(5.5);
  });

  test("inkluderer utvidede plantmålinger (vifte-flow, RV-virkningsgrad)", () => {
    const steps = [
      {
        ...makeStep(10, 18, 17.5),
        supplyFanFlowM3h: 4200,
        exhaustFanFlowM3h: 3950,
        heatRecoveryEfficiencyPct: 72.5,
        heatingCoilTempC: 8.2,
        coolingValveFeedbackPct: 0,
      },
      {
        ...makeStep(11, 18, 17.5),
        supplyFanFlowM3h: 4100,
        exhaustFanFlowM3h: 3880,
        heatRecoveryEfficiencyPct: 71.0,
      },
    ];
    const comparison = buildMpcSignalComparison(steps);

    const safFlow = comparison.series.find((s) => s.id === "supply_fan_flow");
    expect(safFlow).toBeDefined();
    expect(safFlow!.points[0]!.observed).toBe(4200);
    expect(safFlow!.points[1]!.observed).toBe(4100);

    const rvEff = comparison.series.find((s) => s.id === "heat_recovery_efficiency");
    expect(rvEff).toBeDefined();
    expect(rvEff!.points[0]!.observed).toBe(72.5);
    expect(rvEff!.unit).toBe("%");
  });

  test("normaliserer prosent til 1 desimal i sammenligning", () => {
    const comparison = buildMpcSignalComparison(
      [
        {
          ...makeStep(10, 18, 17.5),
          uBmsMeas: {
            supplySetpointC: 18,
            supplyFanPct: 67.55,
            exhaustFanPct: 38,
            heatingValvePct: 10,
            coolingValvePct: 0,
            districtTr002ValvePct: 0,
            districtTr003ValvePct: 0,
          },
          uBmsSim: {
            supplySetpointC: 18,
            supplyFanPct: 68,
            exhaustFanPct: 38,
            heatingValvePct: 10,
            coolingValvePct: 0,
            districtTr002ValvePct: 0,
            districtTr003ValvePct: 0,
          },
          uMpc: {
            supplySetpointC: 18,
            supplyFanPct: 68,
            exhaustFanPct: 38,
            heatingValvePct: 10,
            coolingValvePct: 0,
            districtTr002ValvePct: 0,
            districtTr003ValvePct: 0,
          },
        },
      ],
      { resolution: "step" },
    );
    const fan = comparison.series.find((s) => s.id === "supply_fan_mpc");
    expect(fan?.points[0]?.observed).toBe(67.6);
    expect(fan?.points[0]?.emulated).toBe(68);
    expect(fan?.points[0]?.mpc).toBe(68);
    expect(fan?.summary.meanAbsErrorObservedVsMpc).toBe(0.4);
    expect(fan?.summary.stepsWithMpcVsEmulatedDelta).toBe(0);
  });

  test("teller steg med MPC vs emulert BMS-avvik", () => {
    const comparison = buildMpcSignalComparison(
      [
        {
          ...makeStep(10, 18, 17.5),
          uMpc: {
            supplySetpointC: 17.2,
            supplyFanPct: 35,
            exhaustFanPct: 33,
            heatingValvePct: 8,
            coolingValvePct: 0,
            districtTr002ValvePct: 0,
            districtTr003ValvePct: 0,
          },
        },
      ],
      { resolution: "step" },
    );
    const sp = comparison.series.find((s) => s.id === "supply_setpoint_mpc");
    expect(sp?.summary.stepsWithMpcVsEmulatedDelta).toBe(1);
    expect(sp?.summary.meanAbsErrorMpcVsEmulated).not.toBeNull();
  });
});
