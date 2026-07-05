import { describe, expect, test } from "bun:test";
import {
  SD_ANLEGG_LIVE_INFLUX_QUERY_LOOKBACK_HOURS,
  SD_ANLEGG_LIVE_INFLUX_STREAM_LOOKBACK_MINUTES,
  SD_ANLEGG_LIVE_POLL_MS,
  SD_ANLEGG_LIVE_STREAM_FRESH_MINUTES,
  isFreshInfluxLiveSample,
} from "../live-display-policy";

describe("live-display-policy", () => {
  test("poll hvert 15 sekund", () => {
    expect(SD_ANLEGG_LIVE_POLL_MS).toBe(15_000);
  });

  test("stream lookback er kort søkevindu, ikke 15m-oppløsning", () => {
    expect(SD_ANLEGG_LIVE_INFLUX_STREAM_LOOKBACK_MINUTES).toBe(
      SD_ANLEGG_LIVE_STREAM_FRESH_MINUTES + 1,
    );
    expect(SD_ANLEGG_LIVE_INFLUX_STREAM_LOOKBACK_MINUTES).toBeLessThan(15);
  });

  test("tail lookback går mot Influx API, ikke Postgres", () => {
    expect(SD_ANLEGG_LIVE_INFLUX_QUERY_LOOKBACK_HOURS).toBeGreaterThan(1);
  });

  test("live-label terskel", () => {
    expect(SD_ANLEGG_LIVE_STREAM_FRESH_MINUTES).toBe(5);
  });

  test("isFreshInfluxLiveSample", () => {
    const now = new Date("2026-06-21T12:00:00.000Z");
    expect(
      isFreshInfluxLiveSample("2026-06-21T11:56:00.000Z", now),
    ).toBe(true);
    expect(
      isFreshInfluxLiveSample("2026-06-21T11:54:00.000Z", now),
    ).toBe(false);
  });
});
