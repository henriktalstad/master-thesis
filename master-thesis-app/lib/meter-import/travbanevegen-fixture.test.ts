/**
 * Fixture-test mot Travbanevegen 2 masterliste.
 *
 * Verifiserer at de typiske tilfellene i kundens utfylte mal blir tolket
 * korrekt av customer-intent-normalizer — uten LLM, kun deterministisk.
 *
 * Kilde: docs/travbanevegen-2-masterliste-feltforslag.csv (55 målere).
 * Testene plukker representative rader fra alle hovedkategoriene:
 * el-distribusjon, varme-produksjon/distribusjon, kjøling, ambient,
 * solcelle, ikke-monterte målere og mellommålere.
 */

import { describe, expect, it } from "vitest";

import { normalizeCustomerIntent } from "./customer-intent-normalizer";
import type { MeteringPointType } from "@/generated/client";

type Fixture = {
  name: string;
  type: MeteringPointType;
  roleText: string;
  parentName?: string;
  energySourceName?: string;
  tenantBillable?: string;
  notes?: string;
};

function row(fields: Fixture) {
  return normalizeCustomerIntent(
    {
      roleText: fields.roleText,
      parentName: fields.parentName ?? null,
      energySourceName: fields.energySourceName ?? null,
      tenantBillable: fields.tenantBillable ?? null,
      notes: fields.notes ?? null,
    },
    fields.type,
  );
}

describe("Travbanevegen 2 masterliste-fixtures", () => {
  it("klassifiserer 'Hovedfordeling' som strøm inn til bygget", () => {
    const intent = row({
      name: "Hovedfordeling",
      type: "ELECTRICITY",
      roleText: "Strøm inn til hele bygget / intern hovedfordeling",
      tenantBillable: "Nei",
    });
    expect(intent.roleIntent).toBe("electricity_grid_main");
    expect(intent.isTenantBillable).toBe(false);
    expect(intent.importStatus).toBe("import");
  });

  it("klassifiserer underfordeling som strøm til last", () => {
    const intent = row({
      name: "Fordeling 433.102 plan 1 bygg C-D",
      type: "ELECTRICITY",
      roleText: "Strøm til underfordeling eller kurs",
      parentName: "Hovedfordeling",
      tenantBillable: "Ja",
    });
    expect(intent.roleIntent).toBe("electricity_load_branch");
    expect(intent.isTenantBillable).toBe(true);
    expect(intent.explicitParentRef?.normalized).toBe("hovedfordeling");
  });

  it("klassifiserer el-kjel som konverteringsinput, ikke fakturerbar", () => {
    const intent = row({
      name: "El-kjel",
      type: "ELECTRICITY",
      roleText: "Tilført elektrisk energi til el-kjel",
      parentName: "Hovedfordeling",
      tenantBillable: "Nei",
      notes:
        "Konverteringsinput. Varme bør faktureres på levert/avgitt varmeside.",
    });
    expect(intent.roleIntent).toBe("electricity_conversion_input");
    expect(intent.isTenantBillable).toBe(false);
  });

  it("klassifiserer produsert varme med brønnpark som kilde", () => {
    const intent = row({
      name: "Varme Produsert",
      type: "HEAT",
      roleText: "Avgitt/produsert varme fra varmepumpe",
      energySourceName: "Fra brønnpark",
      tenantBillable: "Nei",
    });
    expect(intent.roleIntent).toBe("heat_production");
    expect(intent.isTenantBillable).toBe(false);
    expect(intent.explicitEnergySourceRef?.normalized).toBe("fra bronnpark");
  });

  it("klassifiserer 'Varme til Ventilasjon' som branch-mellommåler", () => {
    const intent = row({
      name: "Varme til Ventilasjon",
      type: "HEAT",
      roleText: "Levert varme til ventilasjon, mellommåler",
      energySourceName: "Varme Produsert",
      tenantBillable: "Nei",
      notes:
        "Mellommåler/branch over 360.xxx Varme. Endemålerne under bør faktureres.",
    });
    expect(intent.roleIntent).toBe("heat_distribution");
    expect(intent.hierarchyHint).toBe("BRANCH");
    expect(intent.explicitEnergySourceRef?.normalized).toBe("varme produsert");
  });

  it("klassifiserer levert varme til ventilasjonsaggregat under branch", () => {
    const intent = row({
      name: "360.001 Varme 64kW",
      type: "HEAT",
      roleText: "Levert varme til ventilasjonsaggregat 360.001",
      parentName: "Varme til Ventilasjon",
      energySourceName: "Varme Produsert",
      tenantBillable: "Ja",
    });
    expect(intent.roleIntent).toBe("heat_distribution");
    expect(intent.isTenantBillable).toBe(true);
    expect(intent.explicitParentRef?.normalized).toBe("varme til ventilasjon");
  });

  it("klassifiserer prosesskjøling som levert kjøling", () => {
    const intent = row({
      name: "Prosesskjøling Bygg A - B",
      type: "COOLING",
      roleText: "Levert prosesskjøling til bygningsdel A-B",
      energySourceName: "Fra brønnpark",
      tenantBillable: "Ja",
    });
    expect(intent.roleIntent).toBe("cooling_distribution");
    expect(intent.isTenantBillable).toBe(true);
    expect(intent.explicitEnergySourceRef?.normalized).toBe("fra bronnpark");
  });

  it("klassifiserer 'Fra brønnpark' som kildeenergi/ambient", () => {
    const intent = row({
      name: "Fra brønnpark",
      type: "COOLING",
      roleText: "Kildeenergi fra brønnpark / mulig frikjøling",
      tenantBillable: "Nei",
    });
    expect(intent.roleIntent).toBe("ambient_source");
    expect(intent.isTenantBillable).toBe(false);
  });

  it("klassifiserer solcelle-inverter som produksjon", () => {
    const intent = row({
      name: "Solcelle inverter 471.701 på tak",
      type: "PRODUCTION",
      roleText: "Solcelleproduksjon",
      tenantBillable: "Nei",
    });
    expect(intent.roleIntent).toBe("solar_production");
    expect(intent.isTenantBillable).toBe(false);
  });

  it("hopper over 'Ikke montert'-måler som ikke skal importeres aktivt", () => {
    const intent = row({
      name: "Kjøling til/fra bygg 2 Ikke montert.",
      type: "COOLING",
      roleText: "Levert kjøling til/fra bygg 2",
      energySourceName: "Fra brønnpark",
      tenantBillable: "Nei",
      notes: "Ikke montert. Ikke importer som aktiv/fakturerbar måler.",
    });
    expect(intent.importStatus).toBe("skip");
    expect(intent.importStatusReason?.toLowerCase()).toContain("ikke montert");
    expect(intent.isTenantBillable).toBe(false);
  });

  it("klassifiserer kjølemaskin/varmepumpe-strøm som konverteringsinput", () => {
    const intent = row({
      name: "Kjølemaskin/varmepumpe teknisk rom plan 1",
      type: "ELECTRICITY",
      roleText: "Tilført elektrisk energi til varmepumpe/kjølemaskin",
      parentName: "Hovedfordeling",
      tenantBillable: "Nei",
      notes:
        "Konverteringsinput. Ikke fakturer i tillegg til levert varme/kjøling.",
    });
    expect(intent.roleIntent).toBe("electricity_conversion_input");
    expect(intent.isTenantBillable).toBe(false);
  });
});
