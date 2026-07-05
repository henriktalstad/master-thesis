import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compareEvalGroundTruth,
  loadEvalGroundTruthSeries,
} from "../load-eval-ground-truth";

describe("load-eval-ground-truth", () => {
  it("validerer 15-min CSV mot eval-grid", () => {
    const dir = mkdtempSync(join(tmpdir(), "eval-gt-"));
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify({
        evalStart: "2026-06-24T00:00:00.000Z",
        evalEnd: "2026-06-24T01:00:00.000Z",
        files: ["electricity_15min.csv"],
      }),
    );
    writeFileSync(
      join(dir, "electricity_15min.csv"),
      [
        "timestamp_utc,electricity_kwh,source",
        "2026-06-24T00:00:00.000Z,0.1,BHCC",
        "2026-06-24T00:15:00.000Z,0.2,BHCC",
        "2026-06-24T00:30:00.000Z,0.3,BHCC",
        "2026-06-24T00:45:00.000Z,0.4,BHCC",
        "2026-06-24T01:00:00.000Z,0.5,BHCC",
      ].join("\n"),
    );

    const series = loadEvalGroundTruthSeries(dir);
    expect(series?.electricity15min.size).toBe(5);

    const comparison = compareEvalGroundTruth({
      dir,
      evalStart: "2026-06-24T00:00:00.000Z",
      evalEnd: "2026-06-24T01:00:00.000Z",
      bhccElectricityKwh: 1.0,
    });
    expect(comparison?.totals.electricityKwh).toBe(1.5);
    expect(comparison?.validation.electricity15min?.matchedSteps).toBe(5);
    expect(comparison?.vsBhcc?.electricityDeltaPct).toBe(50);
  });
});
