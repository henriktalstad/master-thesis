import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  pointBelongsToHeatingCuratedUnit,
  resolveCuratedHeatingDomainUnits,
} from "@/lib/sd-anlegg/heating-process-units";
import { NAERBYEN_HEATING_FIXTURES } from "./fixtures/naerbyen-heating-fixtures";

function fixturePoint(
  fixture: (typeof NAERBYEN_HEATING_FIXTURES)[number],
): InfraspawnPointListItem {
  return {
    sourceId: "src-varme",
    sourceLabel: "320.001-3 Fjernvarme",
    objectId: fixture.objectId,
    objectName: fixture.objectName,
    description: fixture.description,
    unit: fixture.unit,
    lastValue: 1,
    lastSampledAt: "2026-06-19T12:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
  };
}

describe("heating curated units", () => {
  test("skiller 3200013, 310001 og 310010", () => {
    const points = NAERBYEN_HEATING_FIXTURES.map(fixturePoint);
    const units = resolveCuratedHeatingDomainUnits(points, [
      { id: "src-varme", label: "320.001-3 Fjernvarme" },
    ]);

    expect(units.map((entry) => entry.unit.unitKey)).toEqual([
      "3200013",
      "310001",
    ]);
    expect(
      units.find((entry) => entry.unit.unitKey === "3200013")?.domainPoints.some(
        (p) => p.objectName === "320003OE001_effekt",
      ),
    ).toBe(true);
    expect(
      units.find((entry) => entry.unit.unitKey === "310001")?.domainPoints.some(
        (p) => p.objectName === "310.001SB501_C",
      ),
    ).toBe(true);
  });

  test("pointBelongsToHeatingCuratedUnit skiller OE per gren", () => {
    const boligOe = fixturePoint({
      objectId: "oe-bolig",
      objectName: "320001OE001_turtemp",
      description: null,
      unit: null,
    });
    const naeringOe = fixturePoint({
      objectId: "oe-naering",
      objectName: "320003OE001_effekt",
      description: null,
      unit: null,
    });

    expect(
      pointBelongsToHeatingCuratedUnit(boligOe, "3200013"),
    ).toBe(true);
    expect(
      pointBelongsToHeatingCuratedUnit(naeringOe, "3200013"),
    ).toBe(true);
    expect(
      pointBelongsToHeatingCuratedUnit(boligOe, "310001"),
    ).toBe(false);
  });

  test("ignorerer varme utenfor kurerte prefiks", () => {
    const foreign = fixturePoint({
      objectId: "foreign",
      objectName: "999.999RT402_MV",
      description: null,
      unit: null,
    });

    expect(
      pointBelongsToHeatingCuratedUnit(foreign, "3200013"),
    ).toBe(false);
    expect(
      resolveCuratedHeatingDomainUnits([foreign], [
        { id: "src-varme", label: "x" },
      ]),
    ).toHaveLength(0);
  });
});
