import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  indexPointsByKey,
  retainPointValuesAcrossPolls,
} from "@/lib/infraspawn/retain-point-values-across-polls";

function point(
  objectId: string,
  lastValue: number | null,
  valueSource: InfraspawnPointListItem["valueSource"],
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "Test",
    objectId,
    objectName: objectId,
    description: null,
    unit: null,
    lastValue,
    lastSampledAt: lastValue == null ? null : "2026-06-20T12:00:00.000Z",
    valueSource,
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
  };
}

describe("retainPointValuesAcrossPolls", () => {
  test("beholder forrige verdi når poll returnerer null", () => {
    const previous = indexPointsByKey([point("a", 24.8, "influx-live")]);
    const retained = retainPointValuesAcrossPolls(
      [point("a", null, "postgres-sync")],
      previous,
    );

    expect(retained[0]?.lastValue).toBe(24.8);
    expect(retained[0]?.valueSource).toBe("influx-live");
  });

  test("oppdaterer når ny verdi kommer inn", () => {
    const previous = indexPointsByKey([point("a", 24.8, "influx-live")]);
    const retained = retainPointValuesAcrossPolls(
      [point("a", 25.1, "influx-live")],
      previous,
    );

    expect(retained[0]?.lastValue).toBe(25.1);
  });
});
