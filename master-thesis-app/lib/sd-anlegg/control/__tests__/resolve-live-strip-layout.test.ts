import { describe, expect, test } from "bun:test";
import { resolveLiveStripLayout } from "@/lib/sd-anlegg/control/resolve-live-strip-layout";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";

const baseline: MpcControlVector = {
  supplySetpointC: 20.8,
  supplyFanPct: 67.7,
  exhaustFanPct: 63.4,
  heatingValvePct: 0,
  coolingValvePct: 37.6,
};

describe("resolveLiveStripLayout", () => {
  test("skjuler estimert kolonne når MPC ≈ estimert baseline", () => {
    const layout = resolveLiveStripLayout({
      observed: {
        supplySetpointOperatorC: 17,
        supplyFanPct: 0,
        exhaustFanPct: 0,
        heatingValvePct: 0,
        coolingValvePct: 0,
      },
      typicalBms: baseline,
      mpc: { ...baseline, supplyFanPct: 65.6, exhaustFanPct: 61.5, coolingValvePct: 37.4 },
    });

    expect(layout.showEstimatedColumn).toBe(false);
    expect(layout.columnCount).toBe(2);
    expect(layout.hasAnyObservedVsMpcDeviation).toBe(true);
  });

  test("viser estimert kolonne når MPC endrer pådrag vs baseline", () => {
    const layout = resolveLiveStripLayout({
      observed: { supplySetpointC: 17, supplyFanPct: 0 },
      typicalBms: baseline,
      mpc: { ...baseline, supplySetpointC: 19.5, supplyFanPct: 55 },
    });

    expect(layout.showEstimatedColumn).toBe(true);
    expect(layout.columnCount).toBe(3);
    expect(layout.mpcDeviatesFromBms).toBe(true);
  });

  test("markerer per-signal avvik mot målt drift", () => {
    const layout = resolveLiveStripLayout({
      observed: {
        supplySetpointOperatorC: 17,
        supplyFanPct: 0,
        exhaustFanPct: 0,
        heatingValvePct: 0,
        coolingValvePct: 0,
      },
      typicalBms: baseline,
      mpc: baseline,
    });

    const fanDeviation = layout.signalDeviations.find((row) => row.key === "supplyFanPct");
    expect(fanDeviation?.hasDeviation).toBe(true);
    expect(fanDeviation?.delta).toBe(67.7);
    expect(layout.observedMatchesMpc).toBe(false);
  });

  test("rapporterer i tråd når alle signaler matcher", () => {
    const layout = resolveLiveStripLayout({
      observed: { supplySetpointC: 20.8, supplyFanPct: 67.7 },
      typicalBms: baseline,
      mpc: baseline,
    });

    expect(layout.observedMatchesMpc).toBe(true);
    expect(layout.hasAnyObservedVsMpcDeviation).toBe(false);
    expect(layout.showEstimatedColumn).toBe(false);
  });
});
