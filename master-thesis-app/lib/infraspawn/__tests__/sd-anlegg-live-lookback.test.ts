import { describe, expect, test } from "bun:test";
import {
  resolveSdAnleggChartInfluxLookbackMinutes,
  resolveSdAnleggLiveChartLookbackMinutes,
  resolveSdAnleggLiveChartMaxRows,
} from "@/lib/infraspawn/sd-anlegg-live-lookback";

describe("resolveSdAnleggLiveChartLookbackMinutes", () => {
  test("bruker gap siden siste speilpunkt, ikke full 2t", () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
    const mirror = new Map([
      [
        "obj-a",
        {
          samples: [{ t: thirtyMinAgo }],
        },
      ],
    ]);

    const minutes = resolveSdAnleggLiveChartLookbackMinutes({
      mirrorByObject: mirror,
      objectIds: ["obj-a"],
      bucketMs: 60_000,
      maxHours: 2,
      minMinutes: 15,
    });

    expect(minutes).toBeGreaterThanOrEqual(15);
    expect(minutes).toBeLessThan(90);
  });

  test("uten speil faller tilbake til max timer", () => {
    const minutes = resolveSdAnleggLiveChartLookbackMinutes({
      mirrorByObject: new Map([["obj-a", { samples: [] }]]),
      objectIds: ["obj-a"],
      maxHours: 2,
      minMinutes: 15,
    });

    expect(minutes).toBe(120);
  });
});
describe("resolveSdAnleggChartInfluxLookbackMinutes", () => {
  test("uten målinger i vindu bruker full chart-periode (cap 72t)", () => {
    const sinceMs = Date.now() - 24 * 3_600_000;
    const mirror = new Map([
      [
        "obj-a",
        {
          samples: [{ t: new Date(Date.now() - 72 * 3_600_000).toISOString() }],
        },
      ],
    ]);

    expect(
      resolveSdAnleggChartInfluxLookbackMinutes({
        mirrorByObject: mirror,
        objectIds: ["obj-a"],
        hours: 24,
        sinceMs,
      }),
    ).toBe(24 * 60);
  });

  test("med målinger i vindu bruker tail-gap", () => {
    const sinceMs = Date.now() - 24 * 3_600_000;
    const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
    const mirror = new Map([
      ["obj-a", { samples: [{ t: thirtyMinAgo }] }],
    ]);

    const minutes = resolveSdAnleggChartInfluxLookbackMinutes({
      mirrorByObject: mirror,
      objectIds: ["obj-a"],
      hours: 24,
      sinceMs,
    });

    expect(minutes).toBeGreaterThanOrEqual(15);
    expect(minutes).toBeLessThan(90);
  });
});

describe("resolveSdAnleggLiveChartMaxRows", () => {
  test("skalerer med antall objekter og lookback", () => {
    expect(resolveSdAnleggLiveChartMaxRows(3, 30)).toBe(3 * 35);
  });
});
