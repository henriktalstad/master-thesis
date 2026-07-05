import { describe, expect, test } from "bun:test";
import {
  assertEvalWindowMatch,
  assertReportStepCount,
} from "@/lib/thesis-export/assert-thesis-report-alignment";
import { verifyDbRunMatchesMemoryReplay } from "@/lib/thesis-export/verify-db-export";
import { resolveThesisExportOutDir } from "@/lib/thesis-export/thesis-export-paths";

describe("assertReportStepCount", () => {
  test("feiler ved avvik", () => {
    expect(assertReportStepCount({ stepCount: 150 }, 804, "tuning")).toContain(
      "150",
    );
    expect(assertReportStepCount({ stepCount: 804 }, 804, "tuning")).toBeNull();
  });
});

describe("resolveThesisExportOutDir", () => {
  test("UI-eksport går til data/exports/", () => {
    const dir = resolveThesisExportOutDir({ exportRunId: "run123", cwd: "/app" });
    expect(dir).toContain("data/exports/run123");
  });
});

describe("verifyDbRunMatchesMemoryReplay", () => {
  test("ok når DB og minne matcher", () => {
    const summary = {
      stepCount: 804,
      deltaCostPct: -2,
      deltaCostVsEmulatedPct: -2.5,
      fallbackSteps: 28,
    };
    const result = verifyDbRunMatchesMemoryReplay({
      run: {
        snapshot: { replaySummary: summary },
      } as never,
      result: { replay: { summary } } as never,
    });
    expect(result.ok).toBe(true);
  });

  test("rapporterer avvik uten å kaste", () => {
    const result = verifyDbRunMatchesMemoryReplay({
      run: {
        snapshot: {
          replaySummary: {
            stepCount: 150,
            deltaCostPct: 0,
            deltaCostVsEmulatedPct: 0,
            fallbackSteps: 0,
          },
        },
      } as never,
      result: {
        replay: {
          summary: {
            stepCount: 804,
            deltaCostPct: -2,
            deltaCostVsEmulatedPct: -2.5,
            fallbackSteps: 28,
          },
        },
      } as never,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe("assertEvalWindowMatch", () => {
  test("sammenligner eval-vindu", () => {
    expect(
      assertEvalWindowMatch(
        { evalStart: "2026-06-24T00:00:00.000Z", evalEnd: "2026-07-02T15:00:00.000Z" },
        { evalStart: "2026-06-24T00:00:00.000Z", evalEnd: "2026-07-02T15:00:00.000Z" },
        "policy",
      ),
    ).toBeNull();
  });
});
