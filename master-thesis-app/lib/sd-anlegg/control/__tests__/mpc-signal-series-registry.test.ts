import { describe, expect, it } from "bun:test";
import { MPC_EVAL_DISTRICT_CANONICALS } from "@/services/mpc/mpc-canonicals";
import { MPC_EVAL_EXTRA_PLANT_CANONICALS } from "@/services/mpc/mpc-canonicals";
import {
  MPC_COMPARISON_DISTRICT_SERIES,
  MPC_COMPARISON_EXTRA_PLANT_SERIES,
  MPC_COMPARISON_SERIES,
} from "@/lib/sd-anlegg/control/mpc-signal-series-registry";

describe("mpc-signal-series-registry", () => {
  it("har graf-serie per utvidet plantmåling i eval", () => {
    for (const canonicalId of MPC_EVAL_EXTRA_PLANT_CANONICALS) {
      const seriesId = canonicalId.replace(/\./g, "_");
      expect(
        MPC_COMPARISON_EXTRA_PLANT_SERIES.some((s) => s.id === seriesId),
        canonicalId,
      ).toBe(true);
      expect(
        MPC_COMPARISON_SERIES.some((s) => s.id === seriesId),
        canonicalId,
      ).toBe(true);
    }
  });

  it("har observert-only serie per fjernvarme tur-temp i eval", () => {
    for (const canonicalId of MPC_EVAL_DISTRICT_CANONICALS) {
      if (!canonicalId.endsWith(".supply.temp")) continue;
      const seriesId = canonicalId.replace(/\./g, "_");
      const series = MPC_COMPARISON_DISTRICT_SERIES.find((s) => s.id === seriesId);
      expect(series, canonicalId).toBeDefined();
      expect(series?.chartVariant).toBe("observed");
      expect(MPC_COMPARISON_SERIES.some((s) => s.id === seriesId)).toBe(true);
    }
    expect(MPC_COMPARISON_SERIES.some((s) => s.id === "district_tr002_valve_mpc")).toBe(
      true,
    );
    expect(MPC_COMPARISON_SERIES.some((s) => s.id === "district_tr003_valve_mpc")).toBe(
      true,
    );
  });
});
