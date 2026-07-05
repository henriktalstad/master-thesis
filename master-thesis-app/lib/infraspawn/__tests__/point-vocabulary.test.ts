import { describe, expect, test } from "bun:test";
import {
  formatInfraspawnPointTechnicalRef,
  resolveHumanInfraspawnPointLabel,
} from "@/lib/infraspawn/point-vocabulary";

describe("resolveHumanInfraspawnPointLabel", () => {
  test("oversetter kjente trykkpunkter", () => {
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "AV-40300",
        objectName: "AI_EAFPressure",
        description: null,
      }),
    ).toBe("Trykk avtrekkskanal");
  });

  test("skiller vifte-signaler fra kanaltrykk", () => {
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "AV-1",
        objectName: "AI_EAFFlow",
        description: null,
        unit: "cubic-meters-per-hour",
      }),
    ).toBe("Luftmengde avtrekk");
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "AO-1",
        objectName: "AO_EAF",
        description: null,
        unit: "percent",
      }),
    ).toBe("Viftehastighet avtrekk");
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "DO-1",
        objectName: "DO_EAFStart",
        description: null,
        unit: "boolean",
      }),
    ).toBe("Drift avtrekksvifte");
  });

  test("prioriterer ordliste over engelsk BACnet-beskrivelse", () => {
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "AV-40300",
        objectName: "AI_EAFPressure",
        description: "Extract air fan press.",
      }),
    ).toBe("Trykk avtrekkskanal");
  });

  test("prioriterer ordliste over engelsk objectName", () => {
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "AV-40299",
        objectName: "Supply air fan press.",
        description: "Supply air fan press.",
      }),
    ).toBe("Trykk tilluftskanal");
  });

  test("bruker beskrivelse for ukjente signaler", () => {
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "MSV-999",
        objectName: "CustomSensor",
        description: "Temperatur turledning",
      }),
    ).toBe("Temperatur turledning");
  });

  test("oversetter settpunkt fra tappevann (310.001)", () => {
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "AO-12001",
        objectName: "310.001RT402_SP",
        description: null,
      }),
    ).toBe("Settpunkt tappevann (TR001)");
  });

  test("oversetter kompenseringskurve med kurvenummer", () => {
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "AO-22001",
        objectName: "Kompenseringskurve Y4 Regulert Verdi",
        description: null,
      }),
    ).toBe("Setpunkt kompenseringskurve Y4");
  });

  test("skiller varmegjenvinner-signaler fra romtemperatur", () => {
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "AV-40395",
        objectName: "Efficiency",
        description: "Efficiency for exchanger",
      }),
    ).toBe("Virkningsgrad varmegjenvinner");
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "BV-20077",
        objectName: "Rotationguardexchanger",
        description: "Rotation guard exchanger",
      }),
    ).toBe("Rotasjonsvakt varmegjenvinner");
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "BV-20075",
        objectName: "Lowefficiency",
        description: "Low efficiency",
      }),
    ).toBe("Lav virkningsgrad (varmegjenvinner)");
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "AV-40325",
        objectName: "AI_EfficiencyTemp",
        description: "temp. efficiency sensor",
      }),
    ).toBe("Temperatur etter varmegjenvinner");
  });

  test("oversetter driftsmodus og følgefeil for vifter", () => {
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "MSVV-40350",
        objectName: "EAFAutoMode",
        description: "Running mode EAF",
      }),
    ).toBe("Driftsmodus avtrekksvifte");
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "MSVV-40351",
        objectName: "SAFAutoMode",
        description: "Running mode SAF",
      }),
    ).toBe("Driftsmodus tilluftsvifte");
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "BV-20080",
        objectName: "EAFcontError",
        description: "EAF cont. error",
      }),
    ).toBe("Følgefeil avtrekksvifte");
    expect(
      resolveHumanInfraspawnPointLabel({
        objectId: "BV-20081",
        objectName: "SAFcontError",
        description: "SAF cont. error",
      }),
    ).toBe("Følgefeil tilluftsvifte");
  });
});

describe("formatInfraspawnPointTechnicalRef", () => {
  test("viser teknisk referanse uten engelske BACnet-navn", () => {
    expect(
      formatInfraspawnPointTechnicalRef({
        objectId: "AV-40300",
        objectName: "AI_EAFPressure",
        description: null,
      }),
    ).toBe("AV-40300");
    expect(
      formatInfraspawnPointTechnicalRef({
        objectId: "AV-40395",
        objectName: "Efficiency",
        description: "Efficiency for exchanger",
      }),
    ).toBe("AV-40395");
  });
});
