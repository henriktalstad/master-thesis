import { describe, expect, test } from "bun:test";
import {
  parseSdAnleggPathname,
  resolveSdAnleggNavSegment,
  sdAnleggDomainHref,
  sdAnleggHrefForBuildingSwitch,
} from "@/lib/sd-anlegg/anleggsenhet-routes";

describe("anleggsenhet-routes", () => {
  test("bygger domene-URL med og uten enhet", () => {
    expect(sdAnleggDomainHref("naerbyen", "ventilasjon")).toBe(
      "/sd-anlegg/naerbyen/ventilasjon",
    );
    expect(sdAnleggDomainHref("naerbyen", "ventilasjon", "360102")).toBe(
      "/sd-anlegg/naerbyen/ventilasjon/360102",
    );
  });

  test("parser nested domene-sti", () => {
    expect(
      parseSdAnleggPathname("/sd-anlegg/naerbyen/ventilasjon/360102"),
    ).toEqual({
      segment: "ventilasjon",
      domain: "ventilasjon",
      unitSlug: "360102",
    });
    expect(parseSdAnleggPathname("/sd-anlegg/naerbyen/varme")).toEqual({
      segment: "varme",
      domain: "varme",
      unitSlug: undefined,
    });
    expect(parseSdAnleggPathname("/sd-anlegg/naerbyen/alarmer")).toEqual({
      segment: "alarmer",
    });
    expect(parseSdAnleggPathname("/sd-anlegg/naerbyen/styring")).toEqual({
      segment: "styring",
    });
  });

  test("resolveSdAnleggNavSegment matcher domene selv med enhet", () => {
    expect(
      resolveSdAnleggNavSegment("/sd-anlegg/naerbyen/ventilasjon/kilde-src-1"),
    ).toBe("ventilasjon");
  });

  test("sdAnleggHrefForBuildingSwitch bevarer fane og dropper enhet", () => {
    expect(
      sdAnleggHrefForBuildingSwitch("/sd-anlegg/naerbyen", "sorgenfri"),
    ).toBe("/sd-anlegg/sorgenfri");

    expect(
      sdAnleggHrefForBuildingSwitch("/sd-anlegg/naerbyen/alarmer", "sorgenfri"),
    ).toBe("/sd-anlegg/sorgenfri/alarmer");

    expect(
      sdAnleggHrefForBuildingSwitch("/sd-anlegg/naerbyen/styring", "sorgenfri"),
    ).toBe("/sd-anlegg/sorgenfri/styring");

    expect(
      sdAnleggHrefForBuildingSwitch(
        "/sd-anlegg/naerbyen/ventilasjon/360102",
        "sorgenfri",
      ),
    ).toBe("/sd-anlegg/sorgenfri/ventilasjon");

    expect(
      sdAnleggHrefForBuildingSwitch("/sd-anlegg/naerbyen/varme", "sorgenfri"),
    ).toBe("/sd-anlegg/sorgenfri/varme");
  });
});
