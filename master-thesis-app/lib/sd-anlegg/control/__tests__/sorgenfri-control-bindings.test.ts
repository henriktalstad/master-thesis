import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { MPC_EVAL_DATASET_CANONICALS } from "@/services/mpc/mpc-canonicals";
import {
  isSorgenfriCaseBuilding,
  materializeSorgenfriControlBindings,
  SORGENFRI_BUILDING_SLUG,
} from "@/lib/sd-anlegg/control/sorgenfri-control-bindings";

function point(
  objectId: string,
  objectName: string,
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "Nærbyen",
    objectId,
    objectName,
    description: null,
    unit: null,
    lastValue: null,
    lastSampledAt: null,
    valueSource: "postgres-sync",
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
  };
}

const naerbyenPoints: InfraspawnPointListItem[] = [
  point("AV-30588", "SupplySetpoint"),
  point("AV-40433", "SupplyPID_SetP"),
  point("AV-40353", "AO_SAF"),
  point("AV-40354", "AO_EAF"),
  point("AV-40372", "AO_3"),
  point("AV-40373", "AO_4"),
  point("AV-40374", "AO_5"),
  point("AV-40294", "AI_ExtractAirTemp"),
  point("AV-40292", "AI_SupplyAirTemp"),
  point("AV-40291", "AI_IntakeAirTemp"),
  point("AV-40325", "AI_EfficiencyTemp"),
  point("AV-30589", "ExtractSetpoint"),
  point("AI-2", "320.001RT901_MV"),
  point("AV-5986", "AI_SAFFlow"),
  point("AV-5987", "AI_EAFFlow"),
  point("AV-5518", "AI_FrostprotTemp1"),
  point("AV-7748", "Efficiency"),
  point("AV-7980", "Frostrisk"),
  point("AO-2", "320.002SB502_C"),
  point("AO-3", "320.003SB502_C"),
  point("AV-9001", "320.002RT402_MV"),
  point("AV-9002", "320.003RT402_MV"),
  point("AI-18", "320.002RT502_MV"),
  point("AI-19", "320.003RT502_MV"),
  point("AV-12", "320.002RT402_SPK"),
  point("AV-25", "320.003RT402_SPK"),
  point("AI-5", "320001OE001_energi"),
  point("AI-7", "320001OE001_effekt"),
  point("AI-9", "320001OE001_turtemp"),
  point("AI-10", "320001OE001_returtemp"),
  point("AI-12", "320003OE001_energi"),
  point("AI-14", "320003OE001_effekt"),
  point("AI-16", "320003OE001_turtemp"),
  point("AI-17", "320003OE001_returtemp"),
  point("BO-2", "320.002JP401_S"),
  point("BO-4", "320.003JP401_S"),
  point("AV-8010", "SFP"),
  point("AV-8011", "UnitMode"),
  point("AV-8012", "Rotationguardexchanger"),
  point("AV-8013", "Malf_pumpheater"),
  point("AV-8014", "Malf_pumpcooler"),
];

describe("sorgenfri-control-bindings", () => {
  test("gjenkjenner case-bygg slug", () => {
    expect(isSorgenfriCaseBuilding(SORGENFRI_BUILDING_SLUG)).toBe(true);
    expect(isSorgenfriCaseBuilding("annet-bygg")).toBe(false);
  });

  test("materialiserer eval-canonicals fra Nærbyen-navn", () => {
    const bindings = materializeSorgenfriControlBindings({
      sourceId: "src-1",
      points: naerbyenPoints,
    });

    const requiredEval = MPC_EVAL_DATASET_CANONICALS.filter(
      (id) => !id.startsWith("constraint."),
    );
    for (const canonicalId of requiredEval) {
      expect(
        bindings.some((binding) => binding.canonicalId === canonicalId),
        `mangler ${canonicalId}`,
      ).toBe(true);
    }

    const coolingFeedback = bindings.find(
      (binding) => binding.canonicalId === "cooling.valve.position",
    );
    expect(coolingFeedback?.objectId).toBe("AV-40373");
    expect(coolingFeedback?.unitKey).toBe("360102");

    const supplyFan = bindings.find(
      (binding) => binding.canonicalId === "supply.fan.command",
    );
    expect(supplyFan?.objectId).toBe("AV-40353");

    const tr003Valve = bindings.find(
      (binding) => binding.canonicalId === "district.tr003.valve.command",
    );
    expect(tr003Valve?.objectId).toBe("AO-3");
  });
});
