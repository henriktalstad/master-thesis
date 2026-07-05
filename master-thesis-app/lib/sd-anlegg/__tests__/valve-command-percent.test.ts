import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  formatValveCommandPercentDisplay,
  isAoValveCommandSignal,
  mapValveCommandChartSampleValue,
  resolveValveCommandPercentValue,
} from "../valve-command-percent";

function point(
  partial: Partial<InfraspawnPointListItem> & Pick<InfraspawnPointListItem, "objectName">,
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    objectId: partial.objectId ?? partial.objectName,
    objectName: partial.objectName,
    description: partial.description ?? null,
    unit: partial.unit ?? null,
    lastValue: partial.lastValue ?? null,
    lastSampledAt: partial.lastSampledAt ?? null,
    haystackTags: partial.haystackTags ?? [],
  };
}

describe("isAoValveCommandSignal", () => {
  test("360102_SB401_C med volt er pådrag, ikke feedback", () => {
    const cmd = point({
      objectName: "360102_SB401_C",
      unit: "volts",
      lastValue: 0,
    });
    expect(isAoValveCommandSignal(cmd)).toBe(true);
    expect(formatValveCommandPercentDisplay(cmd)).toBe("0 %");
  });

  test("SB401 volt-feedback er ikke pådrag", () => {
    const feedback = point({
      objectName: "SB401",
      unit: "volts",
      lastValue: 0,
    });
    expect(isAoValveCommandSignal(feedback)).toBe(false);
    expect(resolveValveCommandPercentValue(feedback)).toBeNull();
  });

  test("AO_3 volt normaliseres til prosent", () => {
    const cmd = point({
      objectName: "AO_3",
      unit: "volts",
      lastValue: 4.2,
    });
    expect(isAoValveCommandSignal(cmd)).toBe(true);
    expect(formatValveCommandPercentDisplay(cmd)).toBe("42 %");
  });

  test("diagram-sample normaliseres fra volt til prosent", () => {
    const cmd = point({
      objectName: "360102_SB501_C",
      unit: "volts",
      lastValue: 0,
    });
    expect(mapValveCommandChartSampleValue(2.526, cmd)).toBe(25);
  });
});
