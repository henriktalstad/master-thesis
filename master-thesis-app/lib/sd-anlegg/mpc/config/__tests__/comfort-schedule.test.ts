import { describe, expect, it } from "bun:test";
import {
  NAERBYEN_OFFICE_COMFORT_SCHEDULE,
  buildComfortLambdaHorizon,
  interpolateComfortBand,
  resolveComfortBandForStep,
  resolveComfortBandForStepWithOccupancy,
  resolveComfortLambdaMultiplierForStep,
  resolveLambdaMoveMultiplierForStep,
} from "../comfort-schedule";

const step = (
  hourLocal: number,
  t: string,
): import("@/lib/sd-anlegg/mpc/shared/types").MpcTimestep =>
  ({
    hourLocal,
    t,
  }) as import("@/lib/sd-anlegg/mpc/shared/types").MpcTimestep;

describe("comfort-schedule", () => {
  it("bruker strammere band på ukedag i driftstid", () => {
    const band = resolveComfortBandForStep(
      step(14, "2026-06-24T12:00:00Z"),
      NAERBYEN_OFFICE_COMFORT_SCHEDULE,
      { min: 18, max: 24 },
    );
    expect(band).toEqual({ min: 18, max: 24 });
  });

  it("bruker avslappet band på lørdag", () => {
    const band = resolveComfortBandForStep(
      step(9, "2026-07-04T07:45:00.000Z"),
      NAERBYEN_OFFICE_COMFORT_SCHEDULE,
      { min: 18, max: 24 },
    );
    expect(band).toEqual({ min: 17, max: 26 });
  });

  it("bruker avslappet band om natten", () => {
    const band = resolveComfortBandForStep(
      step(2, "2026-06-24T00:00:00Z"),
      NAERBYEN_OFFICE_COMFORT_SCHEDULE,
      { min: 18, max: 24 },
    );
    expect(band).toEqual({ min: 17, max: 26 });
  });

  it("interpolerer band med q", () => {
    const band = interpolateComfortBand(
      { min: 18, max: 24 },
      { min: 17, max: 26 },
      0.5,
    );
    expect(band.min).toBeCloseTo(17.5);
    expect(band.max).toBeCloseTo(25);
  });

  it("lav q gir avslappet band på ukedag", () => {
    const band = resolveComfortBandForStepWithOccupancy(
      step(14, "2026-06-24T12:00:00Z"),
      NAERBYEN_OFFICE_COMFORT_SCHEDULE,
      { min: 18, max: 24 },
      0,
    );
    expect(band).toEqual({ min: 17, max: 26 });
  });

  it("fallback når schedule mangler", () => {
    const band = resolveComfortBandForStep(
      step(12, "2026-06-24T10:00:00Z"),
      null,
      { min: 19, max: 23 },
    );
    expect(band).toEqual({ min: 19, max: 23 });
  });

  it("høyere λ_comfort i ukedagsdrift enn om natt", () => {
    const drift = resolveComfortLambdaMultiplierForStep(
      step(14, "2026-06-24T12:00:00Z"),
      NAERBYEN_OFFICE_COMFORT_SCHEDULE,
    );
    const natt = resolveComfortLambdaMultiplierForStep(
      step(2, "2026-06-24T00:00:00Z"),
      NAERBYEN_OFFICE_COMFORT_SCHEDULE,
    );
    expect(drift).toBeGreaterThan(natt);
    expect(drift).toBe(14);
    expect(natt).toBe(0.65);
  });

  it("søndag-forvarming senker λ_move", () => {
    const move = resolveLambdaMoveMultiplierForStep(
      step(14, "2026-06-28T12:00:00Z"),
      NAERBYEN_OFFICE_COMFORT_SCHEDULE,
    );
    expect(move).toBe(0.55);
  });

  it("bygger lambda-horisont fra base", () => {
    const lambdas = buildComfortLambdaHorizon(
      [step(14, "2026-06-24T12:00:00Z"), step(2, "2026-06-24T00:00:00Z")],
      NAERBYEN_OFFICE_COMFORT_SCHEDULE,
      1.5,
    );
    expect(lambdas[0]).toBe(21);
    expect(lambdas[1]).toBeCloseTo(0.975);
  });
});
