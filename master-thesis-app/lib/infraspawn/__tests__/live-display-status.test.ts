import { describe, expect, test } from "bun:test";
import { resolveSdAnleggLiveDisplaySubtitle } from "@/lib/infraspawn/live-display-status";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

function point(input: {
  objectId: string;
  lastSampledAt: string | null;
  valueSource: InfraspawnPointListItem["valueSource"];
}): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "Test",
    objectId: input.objectId,
    objectName: input.objectId,
    description: null,
    unit: null,
    lastValue: 1,
    lastSampledAt: input.lastSampledAt,
    valueSource: input.valueSource,
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
  };
}

describe("resolveSdAnleggLiveDisplaySubtitle", () => {
  const now = new Date("2026-06-21T14:00:00.000Z");

  test("lagret verdi uten live", () => {
    const subtitle = resolveSdAnleggLiveDisplaySubtitle({
      livePoints: [
        point({
          objectId: "RT401",
          lastSampledAt: "2026-06-21T09:00:00.000Z",
          valueSource: "postgres-sync",
        }),
      ],
      oldestSuccessfulSyncAt: "2026-06-21T09:00:00.000Z",
      now,
    });

    expect(subtitle).toMatch(/^Lagret ·/);
    expect(subtitle).not.toContain("Live");
  });

  test("fersk live-verdi", () => {
    const subtitle = resolveSdAnleggLiveDisplaySubtitle({
      livePoints: [
        point({
          objectId: "RT401",
          lastSampledAt: "2026-06-21T13:58:00.000Z",
          valueSource: "influx-live",
        }),
      ],
      oldestSuccessfulSyncAt: null,
      now,
    });

    expect(subtitle).toMatch(/^Live ·/);
  });
});
