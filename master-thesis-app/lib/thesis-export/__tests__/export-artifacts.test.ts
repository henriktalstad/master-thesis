import { describe, expect, it } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildMpcCounterfactualCsv } from "../write-mpc-artifacts";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

const ROOT = resolve(import.meta.dir, "../../../..");
const PROCESSED = resolve(ROOT, "data/processed");

const minimalStep: MpcReplayStep = {
  t: "2026-06-24T08:00:00.000Z",
  uBmsMeas: null,
  uBmsSim: {
    supplySetpointC: 20,
    supplyFanPct: 50,
    exhaustFanPct: 50,
    heatingValvePct: 0,
    coolingValvePct: 0,
    districtTr002ValvePct: 0,
    districtTr003ValvePct: 0,
  },
  uMpc: {
    supplySetpointC: 20,
    supplyFanPct: 50,
    exhaustFanPct: 50,
    heatingValvePct: 0,
    coolingValvePct: 0,
    districtTr002ValvePct: 0,
    districtTr003ValvePct: 0,
  },
  deltaU: {
    supplySetpointC: 0,
    supplyFanPct: 0,
    exhaustFanPct: 0,
    heatingValvePct: 0,
    coolingValvePct: 0,
    districtTr002ValvePct: 0,
    districtTr003ValvePct: 0,
  },
  extractTempMeasC: 21,
  extractTempPredC: 21,
  electricKw: 0.5,
  heatKw: 0.1,
  marginalKrPerKwh: 1,
  spotKrPerKwh: 1,
  outdoorTempC: 10,
  costBaselineKr: 0.1,
  costEmulatedKr: 0.1,
  costMpcKr: 0.09,
  comfortViolation: false,
  usedFallback: false,
  proxyElKwhEmulated: 0.2,
  proxyHeatKwhEmulated: 0.05,
  proxyElKwhMpc: 0.18,
  proxyHeatKwhMpc: 0.04,
};

describe("thesis export artifacts", () => {
  it("buildMpcCounterfactualCsv inkluderer proxy- og prisband-kolonner", () => {
    const head = buildMpcCounterfactualCsv([minimalStep]).split("\n")[0] ?? "";
    expect(head).toContain("controllable_kwh_emulated");
    expect(head).toContain("controllable_kwh_mpc");
    expect(head).toContain("price_band");
  });

  it("buildMpcCounterfactualCsv inkluderer TR002/TR003 district-kolonner for alle policy-spor", () => {
    const head = buildMpcCounterfactualCsv([minimalStep]).split("\n")[0] ?? "";
    expect(head).toContain("u_meas_district_tr002_valve_pct");
    expect(head).toContain("u_meas_district_tr003_valve_pct");
    expect(head).toContain("u_bms_sim_district_tr002_valve_pct");
    expect(head).toContain("u_bms_sim_district_tr003_valve_pct");
    expect(head).toContain("u_mpc_district_tr002_valve_pct");
    expect(head).toContain("u_mpc_district_tr003_valve_pct");
    expect(head).toContain("u_demand_district_tr002_valve_pct");
    expect(head).toContain("u_demand_district_tr003_valve_pct");
  });

  it("metrics_summary.json har påkrevde replay-felter", () => {
    const path = resolve(PROCESSED, "metrics_summary.json");
    expect(existsSync(path)).toBe(true);
    const metrics = JSON.parse(readFileSync(path, "utf-8"));
    expect(metrics.replaySummary?.stepCount).toBeGreaterThan(0);
    expect(metrics.replaySummary?.totalCostMpcKr).toBeDefined();
    expect(metrics.replaySummary?.policySummaries?.length).toBeGreaterThanOrEqual(4);
  });

  it("mpc_counterfactual.csv har mpc-kolonner", () => {
    const path = resolve(PROCESSED, "mpc_counterfactual.csv");
    expect(existsSync(path)).toBe(true);
    const head = readFileSync(path, "utf-8").split("\n")[0] ?? "";
    expect(head).toContain("u_mpc_supply_setpoint_c");
    expect(head).toContain("cost_mpc_kr");
    expect(head).toContain("u_mpc_district_tr002_valve_pct");
  });
});
