import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import { resolveDomainAnleggsenheter, resolveDomainAnleggsenhetNavEntries, resolveSdAnleggDomainHref } from "@/lib/sd-anlegg/resolve-domain-anleggsenheter";
import { NAERBYEN_HEATING_FIXTURES } from "./fixtures/naerbyen-heating-fixtures";

function point(
  overrides: Partial<InfraspawnPointListItem>,
): InfraspawnPointListItem {
  return {
    sourceId: "src-varme",
    sourceLabel: "320.001-3 Fjernvarme",
    objectId: "AI-1",
    objectName: null,
    description: null,
    unit: null,
    lastValue: 1,
    lastSampledAt: "2026-06-19T12:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

describe("resolveSdAnleggDomainHref", () => {
  test("peker direkte til kurert fjernvarme når bare bolig-punkter finnes", () => {
    const points = NAERBYEN_HEATING_FIXTURES.filter((fixture) =>
      fixture.objectName.startsWith("320.002"),
    ).map((fixture) =>
      point({
        objectId: fixture.objectId,
        objectName: fixture.objectName,
        description: fixture.description,
        unit: fixture.unit,
      }),
    );

    expect(
      resolveSdAnleggDomainHref(
        "sorgenfriveien-32ab",
        InfraspawnSystemDomain.HEATING,
        points,
        [{ id: "src-varme", label: "320.001-3 Fjernvarme" }],
      ),
    ).toBe("/sd-anlegg/sorgenfriveien-32ab/varme/3200013");
  });

  test("peker til 320001-3 som standard når flere kurerte enheter finnes", () => {
    const points = NAERBYEN_HEATING_FIXTURES.map((fixture) =>
      point({
        objectId: fixture.objectId,
        objectName: fixture.objectName,
        description: fixture.description,
        unit: fixture.unit,
      }),
    );

    const href = resolveSdAnleggDomainHref(
      "sorgenfriveien-32ab",
      InfraspawnSystemDomain.HEATING,
      points,
      [{ id: "src-varme", label: "320.001-3 Fjernvarme" }],
    );

    expect(href).toBe("/sd-anlegg/sorgenfriveien-32ab/varme/3200013");
  });
});

describe("resolveDomainAnleggsenheter", () => {
  test("eksporterer kurerte varmeenheter for Nærbyen-fixture", () => {
    const points = NAERBYEN_HEATING_FIXTURES.map((fixture) =>
      point({
        objectId: fixture.objectId,
        objectName: fixture.objectName,
        description: fixture.description,
        unit: fixture.unit,
      }),
    );

    const units = resolveDomainAnleggsenheter(
      points,
      [{ id: "src-varme", label: "320.001-3 Fjernvarme" }],
      InfraspawnSystemDomain.HEATING,
    );

    expect(units.map((entry) => entry.unit.unitKey)).toEqual([
      "3200013",
      "310001",
    ]);
  });
});

describe("resolveDomainAnleggsenhetNavEntries", () => {
  test("nav matcher filtrerte enheter uten 0-signaler i domenet", () => {
    const points = NAERBYEN_HEATING_FIXTURES.map((fixture) =>
      point({
        objectId: fixture.objectId,
        objectName: fixture.objectName,
        description: fixture.description,
        unit: fixture.unit,
      }),
    );

    const filtered = resolveDomainAnleggsenheter(
      points,
      [{ id: "src-varme", label: "320.001-3 Fjernvarme" }],
      InfraspawnSystemDomain.VENTILATION,
    );
    const nav = resolveDomainAnleggsenhetNavEntries(
      points,
      [{ id: "src-varme", label: "320.001-3 Fjernvarme" }],
      InfraspawnSystemDomain.VENTILATION,
    );

    expect(filtered).toHaveLength(0);
    expect(nav).toHaveLength(0);
  });
});
