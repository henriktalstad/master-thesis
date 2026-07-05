import { describe, expect, it } from "bun:test";
import {
  formatInfraspawnChartSeriesLabel,
  resolveAlarmDisplayContext,
} from "../resolve-alarm-display-context";

describe("resolveAlarmDisplayContext", () => {
  it("bruker featured label som lokasjon", () => {
    expect(
      resolveAlarmDisplayContext({
        sourceId: "src-1",
        objectId: "362.001RT601_MV",
        alarmText: "362.001RT601_MV: Romtemperatur",
        featuredPointRefs: [
          {
            sourceId: "src-1",
            objectId: "362.001RT601_MV",
            label: "Heissjakt bygg B",
          },
        ],
      }),
    ).toMatchObject({
      locationLabel: "Heissjakt bygg B",
      signalLabel: "Romtemperatur",
      equipmentRef: "RT601",
      primaryTitle: "Heissjakt bygg B",
      secondaryLine: "RT601 · Romtemperatur",
      modalTitle: "Romtemp. heissjakt bygg b",
    });
  });

  it("normaliserer alarmText med kolon", () => {
    expect(
      resolveAlarmDisplayContext({
        sourceId: "src-1",
        objectId: "362.001RT601_MV",
        alarmText: "362.001RT601_MV: Romtemperatur",
      }).signalLabel,
    ).toBe("Romtemperatur");
  });

  it("faller tilbake til signal uten lokasjon", () => {
    expect(
      resolveAlarmDisplayContext({
        sourceId: "src-1",
        objectId: "362.001RT601_MV",
        alarmText: "",
      }),
    ).toMatchObject({
      locationLabel: null,
      primaryTitle: "Romtemperatur",
      equipmentRef: "RT601",
    });
  });

  it("bruker pointDisplayOverrides for teknisk objectId", () => {
    expect(
      resolveAlarmDisplayContext({
        sourceId: "src-1",
        objectId: "AI-20",
        alarmText: "AI-20",
        pointDisplayOverrides: [
          {
            sourceId: "src-1",
            objectId: "AI-20",
            label: "Heissjakt bygg B",
          },
        ],
      }),
    ).toMatchObject({
      locationLabel: "Heissjakt bygg B",
      primaryTitle: "Heissjakt bygg B",
    });
  });

  it("matcher featured via TFM equipment-kode", () => {
    expect(
      resolveAlarmDisplayContext({
        sourceId: "src-1",
        objectId: "362.001RT601_MV",
        alarmText: "AI-20",
        featuredPointRefs: [
          {
            sourceId: "src-1",
            objectId: "362.001RT601_MV",
            label: "Heissjakt bygg B",
          },
        ],
      }),
    ).toMatchObject({
      locationLabel: "Heissjakt bygg B",
      signalLabel: "Romtemperatur",
      primaryTitle: "Heissjakt bygg B",
    });
  });

  it("normaliserer objectId uten punktum ved profil-match", () => {
    expect(
      resolveAlarmDisplayContext({
        sourceId: "src-1",
        objectId: "362001RT601_MV",
        alarmText: "Romtemperatur",
        featuredPointRefs: [
          {
            sourceId: "src-1",
            objectId: "362.001RT601_MV",
            label: "Heissjakt bygg B",
          },
        ],
      }),
    ).toMatchObject({
      locationLabel: "Heissjakt bygg B",
      primaryTitle: "Heissjakt bygg B",
    });
  });

  it("humaniserer AI-20 med punktmeta", () => {
    expect(
      resolveAlarmDisplayContext({
        sourceId: "src-1",
        objectId: "AI-20",
        alarmText: "AI-20",
        objectName: "362.001RT601_MV",
        description: "Romtemperatur heissjakt",
      }),
    ).toMatchObject({
      signalLabel: "Romtemperatur",
      locationLabel: "Heissjakt",
      primaryTitle: "Heissjakt",
    });
  });
});

describe("formatInfraspawnChartSeriesLabel", () => {
  it("viser signal og plassering når lokasjon finnes", () => {
    expect(
      formatInfraspawnChartSeriesLabel({
        signalLabel: "Romtemperatur",
        locationLabel: "Heissjakt bygg B",
      }),
    ).toBe("Romtemperatur - Heissjakt bygg B");
  });

  it("viser kun signal uten plassering", () => {
    expect(
      formatInfraspawnChartSeriesLabel({
        signalLabel: "Romtemperatur",
        locationLabel: null,
      }),
    ).toBe("Romtemperatur");
  });
});
