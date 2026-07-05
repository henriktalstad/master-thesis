import { describe, expect, test } from "bun:test";
import {
  hourlyPeakKwFromStepKwh,
  pickProxyHeatKwhEmulated,
} from "../hourly-peak-from-replay-steps";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

describe("hourlyPeakKwFromStepKwh", () => {
  test("summerer 15-min kWh per time (BHCC-konvensjon)", () => {
    const peak = hourlyPeakKwFromStepKwh(
      [
        { t: "2026-06-24T10:00:00.000Z", proxyHeatKwhEmulated: 2.5 },
        { t: "2026-06-24T10:15:00.000Z", proxyHeatKwhEmulated: 5 },
      ] as MpcReplayStep[],
      pickProxyHeatKwhEmulated,
    );
    expect(peak).toBe(7.5);
  });

  test("returnerer null uten energi", () => {
    expect(
      hourlyPeakKwFromStepKwh(
        [{ t: "2026-06-24T10:00:00.000Z" } as MpcReplayStep],
        pickProxyHeatKwhEmulated,
      ),
    ).toBeNull();
  });
});
