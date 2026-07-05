import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  isAhuBindablePoint,
  isHeatingOrTapWaterPoint,
  pointMatchesAhuElementScope,
} from "@/lib/sd-anlegg/ahu-point-eligibility";

function point(
  overrides: Partial<InfraspawnPointListItem>,
): InfraspawnPointListItem {
  return {
    sourceId: "s1",
    sourceLabel: "360.102",
    objectId: "p1",
    objectName: null,
    description: null,
    unit: null,
    lastValue: 1,
    lastSampledAt: "2026-06-19T12:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

describe("ahu-point-eligibility", () => {
  test("310.001 og 320.002 er varme/tappevann", () => {
    expect(
      isHeatingOrTapWaterPoint(
        point({ objectName: "310.001SB501_C" }),
      ),
    ).toBe(true);
    expect(
      isHeatingOrTapWaterPoint(
        point({ objectName: "320.002RT402_MV" }),
      ),
    ).toBe(true);
    expect(isHeatingOrTapWaterPoint(point({ objectName: "SB501" }))).toBe(
      false,
    );
    expect(isHeatingOrTapWaterPoint(point({ objectName: "DO_SeqPumpY1" }))).toBe(
      false,
    );
  });

  test("DO_SeqPumpY1 på 360.102 er AHU-batteripumpe, ikke fjernvarme", () => {
    expect(
      isAhuBindablePoint(point({ objectName: "DO_SeqPumpY1" }), "360102"),
    ).toBe(true);
  });

  test("elementKey scope tillater flate BACnet uten utstyrstag", () => {
    expect(
      pointMatchesAhuElementScope(point({ objectName: "AI_SAFFLOW" }), "360102"),
    ).toBe(true);
    expect(
      pointMatchesAhuElementScope(
        point({ objectName: "362.001RT601_MV" }),
        "360102",
      ),
    ).toBe(false);
  });

  test("isAhuBindablePoint kombinerer scope og domene", () => {
    expect(
      isAhuBindablePoint(point({ objectName: "310.001SB501_C" }), "360102"),
    ).toBe(false);
    expect(isAhuBindablePoint(point({ objectName: "JV401" }), "360102")).toBe(
      true,
    );
  });
});
