import { describe, expect, test } from "bun:test";
import {
  buildMpcDatasetProvenanceDetails,
  formatMpcDatasetProvenanceLine,
} from "@/lib/sd-anlegg/control/format-dataset-provenance";
import type { EvalDatasetProvenance } from "@/lib/sd-anlegg/mpc/shared/types";

const sampleProvenance: EvalDatasetProvenance = {
  primarySource: "postgres",
  tables: {
    infraspawnBacnetSample: {
      rowCount: 12400,
      latestSampleAt: "2026-06-28T12:15:00.000Z",
    },
    weatherObservation: { rowCount: 96 },
    hourlyEnergyPrices: { rowCount: 96 },
    buildingHourlyCostCache: { rowCount: 96 },
    infraspawnAlarmEvent: { rowCount: 3 },
  },
  gapFillApplied: true,
};

describe("formatMpcDatasetProvenanceLine", () => {
  test("bygger kompakt linje med intervaller, rader og siste sample", () => {
    const line = formatMpcDatasetProvenanceLine({
      stepCount: 452,
      provenance: sampleProvenance,
    });
    expect(line).toContain("452 intervaller");
    expect(line).toContain("12");
    expect(line).toContain("400 BACnet-rader");
    expect(line).toContain("siste");
  });

  test("markerer stale når siste prøve er eldre enn terskel", () => {
    const line = formatMpcDatasetProvenanceLine({
      stepCount: 452,
      provenance: sampleProvenance,
      evalEnd: "2026-06-29T00:00:00.000Z",
      now: new Date("2026-06-29T12:00:00.000Z"),
    });
    expect(line).toContain("(stale)");
  });

  test("returnerer null uten provenance", () => {
    expect(
      formatMpcDatasetProvenanceLine({ stepCount: 10, provenance: null }),
    ).toBeNull();
  });
});

describe("buildMpcDatasetProvenanceDetails", () => {
  test("inkluderer postgres og gap-fill", () => {
    const details = buildMpcDatasetProvenanceDetails(sampleProvenance);
    expect(details.some((row) => row.label === "Primærkilde")).toBe(true);
    expect(details.some((row) => row.label === "Gap-fill")).toBe(true);
  });
});
