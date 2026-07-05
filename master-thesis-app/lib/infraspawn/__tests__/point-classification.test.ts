import { describe, expect, test } from "bun:test";
import {
  classifyInfraspawnPoint,
  filterInfraspawnPointsByCategory,
  listVisibleInfraspawnPointCategories,
  resolveInfraspawnPointCategorySelection,
} from "@/lib/infraspawn/point-classification";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

function basePoint(
  overrides: Partial<InfraspawnPointListItem> = {},
): InfraspawnPointListItem {
  return {
    sourceId: "s1",
    sourceLabel: "Kilde",
    objectId: "AI-1",
    objectName: "320001OE001_turtemp",
    description: "Turtemperatur",
    unit: "degrees-celsius",
    lastValue: 42,
    lastSampledAt: "2026-06-19T12:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

describe("classifyInfraspawnPoint", () => {
  test("klassifiserer temperatur", () => {
    expect(classifyInfraspawnPoint(basePoint())).toBe("temperature");
  });

  test("klassifiserer alarm/feil", () => {
    expect(
      classifyInfraspawnPoint(
        basePoint({
          objectName: "SumAlarm",
          description: "Sumalarm",
          statusInAlarm: true,
        }),
      ),
    ).toBe("alarm_fault");
  });

  test("klassifiserer uten verdi", () => {
    expect(classifyInfraspawnPoint(basePoint({ lastValue: null }))).toBe(
      "no_value",
    );
  });

  test("klassifiserer feil med manglende verdi som alarm/feil", () => {
    expect(
      classifyInfraspawnPoint(
        basePoint({
          objectId: "AV-40300",
          objectName: "AI_EAFPressure",
          lastValue: null,
          statusFault: true,
        }),
      ),
    ).toBe("alarm_fault");
  });

  test("klassifiserer trykk", () => {
    expect(
      classifyInfraspawnPoint(
        basePoint({
          objectId: "AV-40301",
          objectName: "AI_SAFPressure",
          description: "Trykk tilluft",
          unit: "pascals",
          lastValue: 120,
        }),
      ),
    ).toBe("pressure");
  });

  test("klassifiserer ukjente signaler med verdi som øvrige", () => {
    expect(
      classifyInfraspawnPoint(
        basePoint({
          objectId: "MSV-999",
          objectName: "CustomSignal",
          description: null,
          unit: null,
          lastValue: 1,
        }),
      ),
    ).toBe("other");
  });
});

describe("listVisibleInfraspawnPointCategories", () => {
  test("viser kun kategorier med signaler pluss Alle", () => {
    const points = [
      basePoint(),
      basePoint({
        objectId: "AV-40300",
        objectName: "AI_EAFPressure",
        lastValue: null,
        statusFault: true,
      }),
    ];

    expect(listVisibleInfraspawnPointCategories(points)).toEqual([
      "all",
      "temperature",
      "alarm_fault",
    ]);
  });
});

describe("resolveInfraspawnPointCategorySelection", () => {
  test("faller tilbake til all når valgt kategori ikke lenger har signaler", () => {
    expect(
      resolveInfraspawnPointCategorySelection("pressure", [
        "all",
        "temperature",
      ]),
    ).toBe("all");
  });

  test("beholder valgt kategori når den fortsatt er synlig", () => {
    expect(
      resolveInfraspawnPointCategorySelection("temperature", [
        "all",
        "temperature",
      ]),
    ).toBe("temperature");
  });
});

describe("filterInfraspawnPointsByCategory", () => {
  test("filtrerer på kategori", () => {
    const points = [
      basePoint(),
      basePoint({
        objectId: "AI-14",
        objectName: "320003OE001_effekt",
        description: "Effekt",
        unit: "kilowatts",
      }),
    ];

    expect(filterInfraspawnPointsByCategory(points, "energy")).toHaveLength(1);
  });
});
