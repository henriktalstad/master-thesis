import { describe, expect, test } from "bun:test";
import type { InfraspawnAlarmEventListItem } from "@/lib/infraspawn/alarm-event-types";
import { buildSdAnleggChartFallbackSamples } from "@/lib/sd-anlegg/chart-fallback-samples";

describe("buildSdAnleggChartFallbackSamples", () => {
  test("bygger punkter fra alarmhistorikk og nåverdi", () => {
    const event = {
      id: "1",
      sourceId: "src",
      objectId: "RT601",
      activatedAt: "2026-06-18T18:20:00.000Z",
      clearedAt: "2026-06-19T11:18:00.000Z",
      valueAtActivation: 29.74,
      severity: "B",
      alarmText: "",
      sourceLabel: null,
      unit: "degrees-celsius",
      currentValue: null,
    } as InfraspawnAlarmEventListItem;

    const { samples, source } = buildSdAnleggChartFallbackSamples({
      group: {
        historyRows: [{ type: "cycle", event }],
        currentValue: 29.94,
      },
      lastSampledAt: "2026-06-20T12:00:00.000Z",
      lastValue: 29.94,
    });

    expect(source).toBe("alarm-cycles");
    expect(samples.length).toBeGreaterThanOrEqual(2);
    expect(samples.some((sample) => sample.value === 29.74)).toBe(true);
    expect(samples.some((sample) => sample.value === 29.94)).toBe(true);
  });
});
