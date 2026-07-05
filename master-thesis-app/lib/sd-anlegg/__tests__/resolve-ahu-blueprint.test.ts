import { describe, expect, test } from "bun:test";
import { AHU_BLUEPRINT_PROCESS_SLOTS, AHU_BLUEPRINT_STATUS_SLOTS } from "@/lib/sd-anlegg/ahu-blueprint";
import {
  resolveAhuBlueprintForTemplate,
  resolveAhuBlueprintOrDefault,
} from "@/lib/sd-anlegg/schema-templates/resolve-ahu-blueprint";
import { VENTILATION_AHU_DUAL_DUCT_HRU } from "@/lib/sd-anlegg/schema-templates/templates/ventilation.ahu.dual_duct_hru";

describe("resolveAhuBlueprintForTemplate", () => {
  test("returnerer blueprint for dual_duct_hru", () => {
    const bundle = resolveAhuBlueprintForTemplate(VENTILATION_AHU_DUAL_DUCT_HRU.id);
    expect(bundle?.processSlots).toBe(AHU_BLUEPRINT_PROCESS_SLOTS);
    expect(bundle?.statusSlots).toBe(AHU_BLUEPRINT_STATUS_SLOTS);
  });

  test("resolveAhuBlueprintOrDefault faller tilbake til standard", () => {
    const unknown = resolveAhuBlueprintOrDefault("unknown.template");
    expect(unknown.processSlots.length).toBe(AHU_BLUEPRINT_PROCESS_SLOTS.length);
  });
});
