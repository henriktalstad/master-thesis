import { describe, expect, it } from "bun:test";
import { parseThesisEnvEndDate } from "@/lib/config/thesis-eval";
import {
  resolveConfiguredEvalWindow,
  trimEvalEndToLastUMeasStep,
} from "@/services/mpc/mpc-eval-window-utils";

describe("parseThesisEnvEndDate", () => {
  it("tolker YYYY-MM-DD som inkluderende sluttdag", () => {
    expect(parseThesisEnvEndDate("2026-07-03")?.toISOString()).toBe(
      "2026-07-04T00:00:00.000Z",
    );
  });
});

describe("resolveConfiguredEvalWindow", () => {
  it("capper evalEnd til nå når konfigurert slutt er i fremtiden", () => {
    const now = new Date("2026-07-02T12:00:00.000Z");
    const { evalEnd } = resolveConfiguredEvalWindow({
      evalStart: new Date("2026-06-24T00:00:00.000Z"),
      evalEnd: new Date("2026-12-31T00:00:00.000Z"),
      now,
    });
    expect(evalEnd.toISOString()).toBe(now.toISOString());
  });
});

describe("trimEvalEndToLastUMeasStep", () => {
  it("trimmer evalEnd til siste uMeas-steg", () => {
    const { evalEnd, trimmed } = trimEvalEndToLastUMeasStep({
      evalEnd: new Date("2026-07-03T00:00:00.000Z"),
      steps: [
        { t: "2026-07-02T12:00:00.000Z", uMeas: { supplySetpointC: 18 } },
        { t: "2026-07-02T12:15:00.000Z", uMeas: null },
      ],
    });
    expect(trimmed).toBe(true);
    expect(evalEnd.toISOString()).toBe("2026-07-02T12:15:00.000Z");
  });
});
