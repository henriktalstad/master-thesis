import { describe, expect, test } from "bun:test";
import {
  buildMpcHourTable,
  buildMpcHourTableFromComparison,
} from "@/lib/sd-anlegg/control/build-mpc-hour-table";
import { buildMpcSignalComparison } from "@/lib/sd-anlegg/control/build-mpc-signal-comparison";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function makeCostStep(hour: number, baseline: number, mpc: number): MpcReplayStep {
  const d = new Date(Date.UTC(2026, 5, 16, hour, 0, 0, 0));
  return {
    t: d.toISOString(),
    uBmsMeas: {
      supplySetpointC: 17,
      supplyFanPct: 40,
      exhaustFanPct: 38,
      heatingValvePct: 10,
      coolingValvePct: 0,
    },
    uBmsSim: {
      supplySetpointC: 17,
      supplyFanPct: 40,
      exhaustFanPct: 38,
      heatingValvePct: 10,
      coolingValvePct: 0,
    },
    uMpc: {
      supplySetpointC: 17,
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
    costBaselineKr: baseline,
    costEmulatedKr: baseline,
    costMpcKr: mpc,
    extractTempMeasC: 22,
    extractTempPredC: 22,
    electricKw: 0.5,
    heatKw: 0.02,
    marginalKrPerKwh: 1.4,
    outdoorTempC: 10,
    comfortViolation: false,
    usedFallback: false,
  };
}

describe("buildMpcHourTableFromComparison", () => {
  test("bygger timetabell fra cost_kr-serie", () => {
    const steps = [
      makeCostStep(10, 1, 0.8),
      makeCostStep(10, 0.5, 0.4),
      makeCostStep(11, 2, 2.1),
    ];
    const comparison = buildMpcSignalComparison(steps);
    const table = buildMpcHourTableFromComparison(comparison);

    expect(table).toHaveLength(2);
    expect(table[0]!.observedCostKr).toBe(1.5);
    expect(table[0]!.mpcCostKr).toBe(1.2);
    expect(table[0]!.deltaCostKr).toBe(-0.3);
  });

  test("buildMpcHourTable matcher hour aggregation", () => {
    const steps = [makeCostStep(10, 1, 0.5), makeCostStep(10, 1, 0.5)];
    expect(buildMpcHourTable(steps)).toEqual(
      buildMpcHourTableFromComparison(buildMpcSignalComparison(steps)),
    );
  });
});
