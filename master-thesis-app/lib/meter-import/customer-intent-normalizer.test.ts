import { describe, expect, it } from "vitest";

import { normalizeCustomerIntent } from "./customer-intent-normalizer";

describe("normalizeCustomerIntent", () => {
  it("tolker strukturerte masterlistevalg og eksplisitte koblinger", () => {
    const intent = normalizeCustomerIntent(
      {
        roleText: "Levert varme til sone, anlegg eller bygningsdel",
        parentName: "Varme til ventilasjon",
        energySourceName: "Varme Produsert",
        tenantBillable: "Ja",
      },
      "HEAT",
    );

    expect(intent.roleIntent).toBe("heat_distribution");
    expect(intent.typeCompatibility).toBe("compatible");
    expect(intent.isTenantBillable).toBe(true);
    expect(intent.explicitParentRef?.normalized).toBe("varme til ventilasjon");
    expect(intent.explicitEnergySourceRef?.normalized).toBe("varme produsert");
  });

  it("bruker friteksten ved Annet / beskriv selv", () => {
    const intent = normalizeCustomerIntent(
      {
        roleText: "Annet / beskriv selv",
        otherDescription: "Fra brønnpark?",
        tenantBillable: "Nei",
      },
      "COOLING",
    );

    expect(intent.roleIntent).toBe("ambient_source");
    expect(intent.typeCompatibility).toBe("compatible");
    expect(intent.isTenantBillable).toBe(false);
    expect(intent.warnings.some((warning) => warning.message.includes("usikker")))
      .toBe(false);
  });

  it("flagger målertype som ikke passer med kundens rollevalg", () => {
    const intent = normalizeCustomerIntent(
      {
        roleText: "Produsert varme fra lokal kilde",
      },
      "ELECTRICITY",
    );

    expect(intent.roleIntent).toBe("heat_production");
    expect(intent.typeCompatibility).toBe("incompatible");
    expect(intent.suggestedMeterType).toBe("HEAT");
    expect(intent.warnings).toHaveLength(1);
  });

  it("foreslår strøm som målertype for konverteringsinput på feil energibærer", () => {
    const intent = normalizeCustomerIntent(
      {
        roleText:
          "Tilført elektrisk energi til varmepumpe, kjølemaskin eller el-kjel",
      },
      "COOLING",
    );

    expect(intent.roleIntent).toBe("electricity_conversion_input");
    expect(intent.typeCompatibility).toBe("corrected_type_suggested");
    expect(intent.suggestedMeterType).toBe("ELECTRICITY");
  });

  it("behandler ikke monterte målere som ikke-importbare", () => {
    const intent = normalizeCustomerIntent(
      {
        roleText: "Strøm til underfordeling, kurs eller utstyr",
        notes: "Ikke montert enda",
      },
      "ELECTRICITY",
    );

    expect(intent.importStatus).toBe("skip");
    expect(intent.importStatusReason).toContain("ikke montert");
  });

  it("tolker eksplisitt hierarkirolle fra masterliste", () => {
    const intent = normalizeCustomerIntent(
      {
        roleText: "Levert varme til sone, anlegg eller bygningsdel",
        hierarchyRole: "Mellommåler",
      },
      "HEAT",
    );

    expect(intent.roleIntent).toBe("heat_distribution");
    expect(intent.hierarchyHint).toBe("BRANCH");
  });
});
