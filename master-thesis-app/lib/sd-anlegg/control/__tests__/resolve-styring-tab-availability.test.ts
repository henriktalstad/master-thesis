import { describe, expect, test } from "bun:test";
import { resolveStyringTabAvailability } from "@/lib/sd-anlegg/control/resolve-styring-tab-availability";

describe("resolveStyringTabAvailability", () => {
  test("låser analyse uten MPC run", () => {
    const tabs = resolveStyringTabAvailability({
      mpcForwardPlan: null,
      mpcPipelineRun: null,
      mpcEvalCoverage: {
        canSimulate: false,
        blockReason: "Mangler energidata",
      } as never,
      simulationError: "Mangler energidata",
      controlTickState: null,
    });

    expect(tabs.find((t) => t.id === "na")?.available).toBe(true);
    expect(tabs.find((t) => t.id === "analyse")?.available).toBe(false);
    expect(tabs.find((t) => t.id === "oppsett")?.available).toBe(true);
  });

  test("åpner analyse fra lagret mpc run", () => {
    const tabs = resolveStyringTabAvailability({
      mpcForwardPlan: null,
      mpcPipelineRun: {
        id: "run-1",
        snapshot: {
          evalStart: "2026-06-16T00:00:00.000Z",
          evalEnd: "2026-06-29T00:00:00.000Z",
          stepCount: 601,
          holdoutStepCount: 180,
          replaySummary: { stepCount: 601 },
        },
      } as never,
      mpcEvalCoverage: { canSimulate: true } as never,
      simulationError: null,
      controlTickState: null,
    });

    expect(tabs.find((t) => t.id === "analyse")?.available).toBe(true);
  });

  test("styring forblir åpen når mpcForwardPlan finnes", () => {
    const tabs = resolveStyringTabAvailability({
      mpcPipelineRun: null,
      mpcForwardPlan: {
        horizonSteps: 96,
        stepMinutes: 15,
        planSteps: [],
        optimizedSteps: 90,
        fallbackSteps: 6,
        fallbackByReason: {
          missing_u_meas: 0,
          simultaneous_heat_cool: 6,
          alarm: 0,
        },
        effect: {
          totalCostBaselineKr: 100,
          totalCostMpcKr: 98,
          deltaCostKr: -2,
          deltaCostPct: -2,
        },
        weatherSource: "met_locationforecast",
        dayAheadHourCount: 24,
        computedAt: "2026-06-29T12:00:00.000Z",
      },
      mpcEvalCoverage: null,
      simulationError: null,
      controlTickState: null,
    });

    expect(tabs.find((t) => t.id === "na")?.available).toBe(true);
  });
});
