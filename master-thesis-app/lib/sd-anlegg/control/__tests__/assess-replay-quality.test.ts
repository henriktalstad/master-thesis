import { describe, expect, test } from "bun:test";
import {
  assessReplayQualityFromSteps,
  isReplayFanSignalPlausible,
} from "@/lib/sd-anlegg/control/assess-replay-quality";

describe("isReplayFanSignalPlausible", () => {
  test("aksepterer realistiske AO_SAF-verdier", () => {
    const samples = Array.from({ length: 170 }, () => 67.5);
    expect(isReplayFanSignalPlausible(samples)).toBe(true);
  });

  test("avviser klemte m³/h-runs (100 % uten 55–75 % band)", () => {
    const samples = [...Array(171).fill(100), ...Array(50).fill(0)];
    expect(isReplayFanSignalPlausible(samples)).toBe(false);
  });

  test("avviser rå luftmengde feilkoblet som %", () => {
    expect(isReplayFanSignalPlausible([3011, 3003, 0])).toBe(false);
  });
});

describe("assessReplayQualityFromSteps", () => {
  test("markerer valid run med realistisk vifte", () => {
    const result = assessReplayQualityFromSteps([
      { uBmsMeas: { supplyFanPct: 68 } },
    ]);
    expect(result.replayQuality).toBe("valid");
    expect(result.maxSupplyFanPct).toBe(68);
  });

  test("markerer invalid_fan ved feilkobling", () => {
    const result = assessReplayQualityFromSteps([
      { uBmsMeas: { supplyFanPct: 3011 } },
    ]);
    expect(result.replayQuality).toBe("invalid_fan");
  });
});
