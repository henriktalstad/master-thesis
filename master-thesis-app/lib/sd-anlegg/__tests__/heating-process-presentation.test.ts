import { describe, expect, test } from "bun:test";
import {
  buildHeatingCombinedPresentationModel,
  buildSumpPitsPresentationModel,
  buildTapWaterPresentationModel,
} from "@/lib/sd-anlegg/heating-process-presentation";
import { NAERBYEN_HEATING_FIXTURES } from "./fixtures/naerbyen-heating-fixtures";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

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
    lastSampledAt: "2026-06-19T12:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
  };
}

describe("heating process presentation", () => {
  test("kombinert fjernvarme bruker riktig OE per gren", () => {
    const points = NAERBYEN_HEATING_FIXTURES.map(fixturePoint);
    const model = buildHeatingCombinedPresentationModel(points);

    expect(model.branches).toHaveLength(2);
    expect(model.branches[0]?.oe.supply.primaryPoint?.objectName).toBe(
      "320001OE001_turtemp",
    );
    expect(model.branches[1]?.oe.power.primaryPoint?.objectName).toBe(
      "320003OE001_effekt",
    );
    expect(model.branches[1]?.supplyTemp.primaryPoint?.objectName).toBe(
      "320.003RT402_MV",
    );
    expect(model.tapWaterLink?.label).toBe("310.001 Forbruksvann");
  });

  test("tappevann-modell henter ventil, pumpe og settpunkt", () => {
    const points = NAERBYEN_HEATING_FIXTURES.filter((f) =>
      f.objectName.startsWith("310.001"),
    ).map(fixturePoint);
    const model = buildTapWaterPresentationModel(points);

    expect(model.valve.primaryPoint?.objectName).toBe("310.001SB501_C");
    expect(model.pump.primaryPoint?.objectName).toMatch(/310\.001JP501_[AS]/);
    expect(model.setpoint.primaryPoint?.objectName).toBe("310.001RT402_SP");
  });

  test("pumpe viser modus og drift separat når S og A finnes", () => {
    const points = NAERBYEN_HEATING_FIXTURES.map(fixturePoint).map((point) => {
      if (point.objectName === "320.002JP401_S") {
        return { ...point, lastValue: 3 };
      }
      if (point.objectName === "320.002JP401_A") {
        return { ...point, lastValue: 1 };
      }
      return point;
    });
    const model = buildHeatingCombinedPresentationModel(points);
    const pump = model.branches[0]?.pump1;

    expect(pump?.displayValue).toBe("AUTO");
    expect(pump?.stateLabel).toBe("PÅ");
    expect(pump?.primaryPoint?.objectName).toBe("320.002JP401_S");
  });

  test("pumpekum-modell har to grener", () => {
    const points = [
      fixturePoint({
        objectId: "pit-a",
        objectName: "310.010JP001_D",
        description: "Drift",
        unit: null,
      }),
      fixturePoint({
        objectId: "pit-b",
        objectName: "310.010JP002_A",
        description: "Alarm",
        unit: null,
      }),
    ];
    const model = buildSumpPitsPresentationModel(points);

    expect(model.pits).toHaveLength(2);
    expect(model.pits[0]?.drift.primaryPoint?.objectName).toBe("310.010JP001_D");
    expect(model.pits[1]?.alarm.primaryPoint?.objectName).toBe("310.010JP002_A");
  });
});
