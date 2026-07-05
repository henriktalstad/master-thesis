import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  formatSdAnleggKeyPointValueParts,
  formatSdAnleggNumericValue,
  formatSdAnleggNumericWithUnit,
  resolveSdAnleggNumericFractionDigits,
} from "@/lib/sd-anlegg/sd-anlegg-display-format";
import { filterSdAnleggChartPointsForSlot, pickDefaultSdAnleggChartPointsForSlot } from "@/lib/sd-anlegg/sd-anlegg-chart-point-filter";
import {
  formatSdAnleggPointDisplayValue,
} from "@/lib/sd-anlegg/format-process-slot-display";

function point(
  overrides: Partial<InfraspawnPointListItem> = {},
): InfraspawnPointListItem {
  return {
    sourceId: "s1",
    objectId: "p1",
    sourceLabel: "Kilde",
    objectName: null,
    description: null,
    unit: null,
    lastValue: 0,
    lastSampledAt: "2026-06-24T05:58:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    valueSource: "postgres-sync",
    ...overrides,
  };
}

describe("resolveSdAnleggNumericFractionDigits", () => {
  test("bruker heltall for flow, prosent og trykk", () => {
    expect(resolveSdAnleggNumericFractionDigits("cubic-meters-per-hour")).toBe(0);
    expect(resolveSdAnleggNumericFractionDigits("percent")).toBe(0);
    expect(resolveSdAnleggNumericFractionDigits("pascals")).toBe(0);
  });

  test("bruker én desimal for temperatur", () => {
    expect(resolveSdAnleggNumericFractionDigits("degrees-celsius")).toBe(1);
  });
});

describe("formatSdAnleggNumericValue", () => {
  test("runder flow og prosent til heltall", () => {
    expect(
      formatSdAnleggNumericWithUnit(2985.66, "cubic-meters-per-hour"),
    ).toMatch(/2[\s\u00a0]?986 m³\/h/);
    expect(formatSdAnleggNumericWithUnit(63.29, "percent")).toBe("63 %");
  });

  test("beholder én desimal for temperatur", () => {
    expect(formatSdAnleggNumericWithUnit(20.54, "degrees-celsius")).toBe(
      "20,5 °C",
    );
  });
});

describe("formatSdAnleggPointDisplayValue", () => {
  test("vifte flow og hastighet uten desimaler", () => {
    const flow = point({
      objectName: "AI_EAFFlow",
      unit: "cubic-meters-per-hour",
      lastValue: 2985.66,
    });
    const speed = point({
      objectName: "AI_EAFSpeed",
      unit: "percent",
      lastValue: 63.29,
    });

    expect(formatSdAnleggPointDisplayValue(flow, "fan")).toMatch(
      /2[\s\u00a0]?986 m³\/h/,
    );
    expect(formatSdAnleggPointDisplayValue(speed, "fan")).toBe("63 %");
  });

  test("EfficiencyTemp formateres som temperatur, ikke prosent", () => {
    const afterHx = point({
      objectName: "AI_EfficiencyTemp",
      description: "Temperatur etter varmegjenvinner",
      unit: "degrees-celsius",
      lastValue: 21,
    });

    expect(formatSdAnleggPointDisplayValue(afterHx)).toBe("21 °C");
  });
});

describe("pickDefaultSdAnleggChartPointsForSlot", () => {
  test("vifte velger luftmengde fremfor hastighet", () => {
    const points = [
      point({
        objectId: "flow",
        objectName: "AI_EAFFlow",
        unit: "cubic-meters-per-hour",
        lastValue: 2985,
      }),
      point({
        objectId: "speed",
        objectName: "AO_EAF",
        unit: "percent",
        lastValue: 63,
      }),
    ];

    const picked = pickDefaultSdAnleggChartPointsForSlot("fan", points);
    expect(picked.map((entry) => entry.objectId)).toEqual(["flow"]);
  });
});

describe("filterSdAnleggChartPointsForSlot", () => {
  test("vifte-graf ekskluderer kanaltrykk", () => {
    const points = [
      point({
        objectId: "flow",
        objectName: "AI_EAFFlow",
        unit: "cubic-meters-per-hour",
        lastValue: 2985,
      }),
      point({
        objectId: "speed",
        objectName: "AI_EAFSpeed",
        unit: "percent",
        lastValue: 63,
      }),
      point({
        objectId: "pressure",
        objectName: "AI_EAFPressure",
        unit: "pascals",
        lastValue: 120,
      }),
    ];

    const filtered = filterSdAnleggChartPointsForSlot("fan", points);
    expect(filtered.map((entry) => entry.objectId)).toEqual(["flow", "speed"]);
  });

  test("VGX-graf ekskluderer temperaturpunkter", () => {
    const points = [
      point({
        objectId: "eff",
        objectName: "Efficiency",
        unit: "percent",
        lastValue: 66,
      }),
      point({
        objectId: "temp",
        objectName: "AI_EfficiencyTemp",
        unit: "degrees-celsius",
        lastValue: 20.1,
      }),
    ];

    const filtered = filterSdAnleggChartPointsForSlot("hx", points);
    expect(filtered.map((entry) => entry.objectId)).toEqual(["eff"]);
  });
});

describe("formatSdAnleggKeyPointValueParts", () => {
  test("bruker SD-desimalpolicy for numeriske nøkkelpunkter", () => {
    const flow = point({
      objectName: "AI_EAFFlow",
      unit: "cubic-meters-per-hour",
      lastValue: 2985.66,
    });
    const parts = formatSdAnleggKeyPointValueParts(flow);
    expect(parts.kind).toBe("numeric");
    if (parts.kind === "numeric") {
      expect(parts.value).toMatch(/2[\s\u00a0]?986/);
      expect(parts.unit).toBe("m³/h");
    }
  });
});

describe("formatSdAnleggNumericValue edge cases", () => {
  test("håndterer null", () => {
    expect(formatSdAnleggNumericValue(null, "percent")).toBe("—");
  });
});
