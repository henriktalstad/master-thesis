import { describe, expect, it } from "bun:test";
import {
  compactMpcReplayStep,
  expandCompactMpcReplayStep,
} from "@/lib/sd-anlegg/control/compact-mpc-replay-step";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

describe("resolveEffectiveEvalWindowForMpc", () => {
  it("eksporterer modul uten runtime-feil", async () => {
    const mod = await import("@/services/mpc/resolve-effective-eval-window");
    expect(typeof mod.resolveEffectiveEvalWindowForMpc).toBe("function");
  });
});

describe("compactMpcReplayStep frost/bms", () => {
  it("runde-tur for outdoorTempFrostC og outdoorTempBmsC", () => {
    const step: MpcReplayStep = {
      t: "2026-06-30T12:00:00.000Z",
      uBmsMeas: {
        supplySetpointC: 18,
        supplyFanPct: 40,
        exhaustFanPct: 35,
        heatingValvePct: 10,
        coolingValvePct: 0,
      },
      uBmsSim: {
        supplySetpointC: 18,
        supplyFanPct: 40,
        exhaustFanPct: 35,
        heatingValvePct: 10,
        coolingValvePct: 0,
      },
      uMpc: {
        supplySetpointC: 18,
        supplyFanPct: 40,
        exhaustFanPct: 35,
        heatingValvePct: 10,
        coolingValvePct: 0,
      },
      deltaU: {
        supplySetpointC: 0,
        supplyFanPct: 0,
        exhaustFanPct: 0,
        heatingValvePct: 0,
        coolingValvePct: 0,
      },
      outdoorTempC: 15.4,
      outdoorTempFrostC: 15.1,
      outdoorTempBmsC: 15.6,
      electricKw: 1,
      heatKw: 0.5,
      costBaselineKr: 1,
      costEmulatedKr: 1,
      costMpcKr: 1,
      comfortViolation: false,
      usedFallback: false,
    };
    const compact = compactMpcReplayStep(step);
    const expanded = expandCompactMpcReplayStep(step.t, compact);
    expect(expanded.outdoorTempFrostC).toBe(15.1);
    expect(expanded.outdoorTempBmsC).toBe(15.6);
  });
});
