import { describe, expect, it } from "bun:test";
import {
  appendLiveSampleToSeriesSamples,
  appendLiveSamplesToChartSeries,
} from "@/lib/sd-anlegg/append-live-chart-sample";

describe("appendLiveSampleToSeriesSamples", () => {
  it("appends live sample when series is empty", () => {
    const result = appendLiveSampleToSeriesSamples([], {
      lastValue: 21.5,
      lastSampledAt: "2026-06-29T12:00:00.000Z",
    });
    expect(result).toEqual([
      { t: "2026-06-29T12:00:00.000Z", value: 21.5 },
    ]);
  });

  it("merges live sample at same timestamp", () => {
    const result = appendLiveSampleToSeriesSamples(
      [{ t: "2026-06-29T12:00:00.000Z", value: 20 }],
      { lastValue: 22, lastSampledAt: "2026-06-29T12:00:00.000Z" },
    );
    expect(result).toEqual([
      { t: "2026-06-29T12:00:00.000Z", value: 22 },
    ]);
  });

  it("appends newer live sample", () => {
    const result = appendLiveSampleToSeriesSamples(
      [{ t: "2026-06-29T11:45:00.000Z", value: 20 }],
      { lastValue: 22, lastSampledAt: "2026-06-29T12:00:00.000Z" },
    );
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      t: "2026-06-29T12:00:00.000Z",
      value: 22,
    });
  });

  it("skips invalid live values", () => {
    const samples = [{ t: "2026-06-29T11:45:00.000Z", value: 20 }];
    expect(
      appendLiveSampleToSeriesSamples(samples, {
        lastValue: null,
        lastSampledAt: "2026-06-29T12:00:00.000Z",
      }),
    ).toEqual(samples);
  });
});

describe("appendLiveSamplesToChartSeries", () => {
  it("updates matching series by key", () => {
    const series = [
      {
        key: "a",
        label: "A",
        samples: [{ t: "2026-06-29T11:45:00.000Z", value: 1 }],
      },
      {
        key: "b",
        label: "B",
        samples: [{ t: "2026-06-29T11:45:00.000Z", value: 2 }],
      },
    ] as const;

    const result = appendLiveSamplesToChartSeries([...series], new Map([
      ["a", { lastValue: 9, lastSampledAt: "2026-06-29T12:00:00.000Z" }],
    ]));

    expect(result[0]?.samples.at(-1)?.value).toBe(9);
    expect(result[1]?.samples.at(-1)?.value).toBe(2);
  });
});
