import { describe, expect, it } from "bun:test";
import {
  parseComfortBandFromBuildingJson,
  resolveComfortBandC,
} from "../parse-building-comfort-band";

describe("parseComfortBandFromBuildingJson", () => {
  it("leser flat min/max", () => {
    expect(parseComfortBandFromBuildingJson({ min: 19, max: 23 })).toEqual({
      min: 19,
      max: 23,
    });
  });

  it("leser comfortBandMinC/MaxC", () => {
    expect(
      parseComfortBandFromBuildingJson({
        comfortBandMinC: 20,
        comfortBandMaxC: 24,
      }),
    ).toEqual({ min: 20, max: 24 });
  });

  it("leser nested ventilation", () => {
    expect(
      parseComfortBandFromBuildingJson({
        ventilation: { minTempC: 18, maxTempC: 24 },
      }),
    ).toEqual({ min: 18, max: 24 });
  });

  it("leser array av mål", () => {
    expect(
      parseComfortBandFromBuildingJson([
        { category: "heating", min: 20, max: 22 },
        { category: "ventilation", min: 18, max: 24 },
      ]),
    ).toEqual({ min: 20, max: 22 });
  });

  it("returnerer null ved ugyldig input", () => {
    expect(parseComfortBandFromBuildingJson(null)).toBeNull();
    expect(parseComfortBandFromBuildingJson({ min: 24, max: 18 })).toBeNull();
  });
});

describe("resolveComfortBandC", () => {
  const base = { min: 18, max: 24 };

  it("prioriterer overrides over DB og default", () => {
    expect(
      resolveComfortBandC({
        base,
        comfortTargets: { min: 19, max: 23 },
        overrides: { comfortBandMinC: 20 },
      }),
    ).toEqual({ min: 20, max: 23 });
  });

  it("bruker DB når overrides mangler", () => {
    expect(
      resolveComfortBandC({
        base,
        comfortTargets: { min: 19, max: 23 },
      }),
    ).toEqual({ min: 19, max: 23 });
  });

  it("faller tilbake til base", () => {
    expect(resolveComfortBandC({ base, comfortTargets: null })).toEqual(base);
  });
});
