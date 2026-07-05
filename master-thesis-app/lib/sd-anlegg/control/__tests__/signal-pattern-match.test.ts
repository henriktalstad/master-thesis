import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { pointMatchesCatalogPattern } from "@/lib/sd-anlegg/control/signal-pattern-match";

function mockPoint(
  overrides: Partial<InfraspawnPointListItem> & Pick<InfraspawnPointListItem, "objectName">,
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "Nærbyen",
    objectId: "AV-1",
    description: null,
    unit: null,
    lastValue: null,
    lastSampledAt: null,
    valueSource: "postgres-sync",
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

describe("signal-pattern-match", () => {
  test("matcher AO_3 kun på objectName, ikke objectId AO-3", () => {
    expect(
      pointMatchesCatalogPattern(
        mockPoint({ objectName: "AO_3", objectId: "AV-40372" }),
        "AO_3",
      ),
    ).toBe(true);
    expect(
      pointMatchesCatalogPattern(
        mockPoint({ objectName: "320.003SB502_C", objectId: "AO-3" }),
        "AO_3",
      ),
    ).toBe(false);
  });

  test("matcher utstyrstag på objectName", () => {
    expect(
      pointMatchesCatalogPattern(
        mockPoint({ objectName: "320.001RT901_MV", objectId: "AI-2" }),
        "320.001RT901_MV",
      ),
    ).toBe(true);
  });
});
