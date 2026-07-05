import { describe, expect, test } from "bun:test";
import {
  RESOLUTION_RANK,
  type WeatherResolution,
} from "@/lib/weather/weather-contract";
import {
  rankWeatherStationSeries,
  normalizeStationItems,
} from "@/lib/weather/rank-weather-station";
import { holdPiecewiseConstant } from "@/lib/weather/resample-weather";

describe("rankWeatherStationSeries", () => {
  test("prioriterer nærhet, deretter oppløsning i tier", () => {
    const stations = normalizeStationItems(
      [
        {
          id: "SN68230",
          name: "RISVOLLAN",
          geometry: { coordinates: [10.41, 63.41] },
        },
        {
          id: "SN68175",
          name: "MOHOLTLIA",
          geometry: { coordinates: [10.42, 63.415] },
        },
      ],
      { lat: 63.404736, lon: 10.39973 },
    );

    const series = [
      {
        elementId: "air_temperature",
        sourceId: "SN68230:0",
        timeResolution: "PT1H" as WeatherResolution,
      },
      {
        elementId: "air_temperature",
        sourceId: "SN68175:0",
        timeResolution: "PT10M" as WeatherResolution,
      },
    ];

    const ranked = rankWeatherStationSeries({
      stations,
      series,
      maxDistanceKm: 5,
      resolutionTierKm: 1,
    });

    expect(ranked?.station.id).toBe("SN68175");
    expect(ranked?.resolution).toBe("PT10M");
  });

  test("ekskluderer stasjon over 5 km selv med PT10M", () => {
    const stations = normalizeStationItems(
      [
        {
          id: "SN68230",
          name: "RISVOLLAN",
          geometry: { coordinates: [10.39973, 63.404736] },
        },
        {
          id: "SN99999",
          name: "FAR",
          geometry: { coordinates: [10.55, 63.45] },
        },
      ],
      { lat: 63.404736, lon: 10.39973 },
    );

    const far = stations.find((s) => s.id === "SN99999");
    expect(far!.distanceKm).toBeGreaterThan(5);

    const series = [
      {
        elementId: "air_temperature",
        sourceId: "SN68230:0",
        timeResolution: "PT1H" as WeatherResolution,
      },
      {
        elementId: "air_temperature",
        sourceId: "SN99999:0",
        timeResolution: "PT10M" as WeatherResolution,
      },
    ];

    const ranked = rankWeatherStationSeries({
      stations,
      series,
      maxDistanceKm: 5,
      resolutionTierKm: 1,
    });

    expect(ranked?.station.id).toBe("SN68230");
  });
});

describe("holdPiecewiseConstant", () => {
  test("PT1H gir 4 punkter per time ved 15 min steg", () => {
    const out = holdPiecewiseConstant(
      [
        {
          time: "2026-01-01T10:00:00.000Z",
          outdoorTempC: 2,
          nativeResolution: "PT1H",
        },
        {
          time: "2026-01-01T11:00:00.000Z",
          outdoorTempC: 2,
          nativeResolution: "PT1H",
        },
      ],
      15 * 60_000,
    );
    expect(out.length).toBeGreaterThanOrEqual(4);
    expect(out.every((p) => p.outdoorTempC === 2)).toBe(true);
  });
});

describe("RESOLUTION_RANK", () => {
  test("PT10M rangerer høyest", () => {
    expect(RESOLUTION_RANK.PT10M).toBeGreaterThan(RESOLUTION_RANK.PT1H);
  });
});
