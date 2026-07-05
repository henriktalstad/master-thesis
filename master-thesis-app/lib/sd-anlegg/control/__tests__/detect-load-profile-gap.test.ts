import { describe, expect, test } from "bun:test";
import {
  applyLoadProfileTrailingGapNulls,
  detectLoadProfileDataGap,
} from "@/lib/sd-anlegg/control/detect-load-profile-gap";
import type { ControlLoadHourPoint } from "@/lib/sd-anlegg/control/control-types";

function point(hour: number, actualKw: number): ControlLoadHourPoint {
  return {
    hour: new Date(Date.UTC(2026, 5, 20, hour, 0, 0)).toISOString(),
    actualKw,
    costKr: 10,
    spotKrPerKwh: 1,
  };
}

describe("detect-load-profile-gap", () => {
  test("applyLoadProfileTrailingGapNulls nuller avsluttende null-serie", () => {
    const profile: ControlLoadHourPoint[] = [
      ...Array.from({ length: 20 }, (_, i) => point(i, 5)),
      ...Array.from({ length: 8 }, (_, i) => point(20 + i, 0)),
    ];

    expect(detectLoadProfileDataGap(profile)).not.toBeNull();

    const nulled = applyLoadProfileTrailingGapNulls(profile);
    expect(nulled[19]!.actualKw).toBe(5);
    expect(nulled[20]!.actualKw).toBeNull();
    expect(nulled[27]!.actualKw).toBeNull();
  });
});
