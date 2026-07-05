import { describe, expect, test } from "bun:test";
import {
  buildInfraspawnPointRawMetadata,
  isInfraspawnPointHealthy,
  parseInfraspawnPointStatusMetadata,
} from "@/lib/infraspawn/point-metadata";
import type { InfraspawnBacnetRow } from "@/lib/infraspawn/types";

describe("point metadata", () => {
  test("bevarer statusfelter i rawMetadata", () => {
    const row: InfraspawnBacnetRow = {
      objectId: "AI-1",
      sampledAt: new Date("2026-06-19T12:00:00.000Z"),
      valueNum: 21,
      quality: "ok",
      objectName: "Temp",
      description: "Temperatur",
      unit: "degrees-celsius",
      raw: {
        destination: "10.30.45.11",
        frame: "5",
        pointCount: 13,
        status_fault: false,
        status_inAlarm: true,
      },
    };

    const metadata = buildInfraspawnPointRawMetadata(row);
    expect(metadata.destination).toBe("10.30.45.11");
    expect(metadata.status_inAlarm).toBe(true);
    expect(metadata.lastSampledAt).toBe("2026-06-19T12:00:00.000Z");
  });

  test("parser status og vurderer helse", () => {
    const status = parseInfraspawnPointStatusMetadata({
      quality: "fault",
      status_fault: true,
      lastSampledAt: "2026-06-19T12:00:00.000Z",
    });

    expect(status?.quality).toBe("fault");
    expect(isInfraspawnPointHealthy(status)).toBe(false);
  });
});
