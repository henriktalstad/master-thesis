import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { buildHeatingDistrictPresentationModel } from "@/lib/sd-anlegg/heating-district-presentation";
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
    lastValue: 42,
    lastSampledAt: "2026-06-20T12:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOutOfService: false,
    statusOverridden: false,
  };
}

describe("buildHeatingDistrictPresentationModel", () => {
  test("bygger skjema fra mal + punkter uten GraphLayout-seed", () => {
    const points = NAERBYEN_HEATING_FIXTURES.map((f) => fixturePoint(f));
    const model = buildHeatingDistrictPresentationModel(points, {
      elementKey: "320002",
    });

    expect(model.boundRoleCount).toBeGreaterThanOrEqual(8);
    expect(model.regulationLabel).toBe("TR002 Boligdel");
    expect(model.outdoorTemp?.equipmentCode).toBe("RT901");
    expect(model.lanes.some((lane) => lane.id === "tapwater")).toBe(true);
    expect(
      model.lanes
        .flatMap((lane) => lane.slots)
        .some((slot) => slot.roleId === "secondary.supply_temp"),
    ).toBe(true);
  });

  test("viser plassholdere for ubundne roller", () => {
    const points = [
      fixturePoint(
        NAERBYEN_HEATING_FIXTURES.find(
          (f) => f.objectName === "320.002RT402_MV",
        )!,
      ),
    ];
    const model = buildHeatingDistrictPresentationModel(points, {
      elementKey: "320002",
    });

    const secondaryValve = model.lanes
      .flatMap((lane) => lane.slots)
      .find((slot) => slot.roleId === "secondary.valve");
    expect(secondaryValve?.confidence).toBe("missing");
    expect(secondaryValve?.displayValue).toBeNull();
  });

  test("skjuler tappevann-lane for næringsdel", () => {
    const points = NAERBYEN_HEATING_FIXTURES.filter((f) =>
      f.objectName.includes("320.003"),
    ).map((f) => fixturePoint(f));

    const model = buildHeatingDistrictPresentationModel(points, {
      elementKey: "320003",
    });

    expect(model.lanes.some((lane) => lane.id === "tapwater")).toBe(false);
    expect(model.regulationLabel).toBe("TR003 Næringsdel");
  });
});
