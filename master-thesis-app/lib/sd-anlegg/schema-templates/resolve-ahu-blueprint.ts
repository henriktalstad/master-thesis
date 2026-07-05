import {
  AHU_BLUEPRINT_PROCESS_SLOTS,
  AHU_BLUEPRINT_STATUS_SLOTS,
  type AhuBlueprintSlotDef,
  type AhuStatusSlotDef,
} from "../ahu-blueprint";
import { VENTILATION_AHU_DUAL_DUCT_HRU } from "./templates/ventilation.ahu.dual_duct_hru";

export type AhuBlueprintBundle = {
  processSlots: readonly AhuBlueprintSlotDef[];
  statusSlots: readonly AhuStatusSlotDef[];
};

const BLUEPRINT_BY_TEMPLATE_ID: Readonly<Record<string, AhuBlueprintBundle>> = {
  [VENTILATION_AHU_DUAL_DUCT_HRU.id]: {
    processSlots: AHU_BLUEPRINT_PROCESS_SLOTS,
    statusSlots: AHU_BLUEPRINT_STATUS_SLOTS,
  },
};

export function resolveAhuBlueprintForTemplate(
  templateId: string | null | undefined,
): AhuBlueprintBundle | null {
  if (!templateId) return null;
  return BLUEPRINT_BY_TEMPLATE_ID[templateId] ?? null;
}

export function resolveAhuBlueprintOrDefault(
  templateId: string | null | undefined,
): AhuBlueprintBundle {
  return (
    resolveAhuBlueprintForTemplate(templateId) ?? {
      processSlots: AHU_BLUEPRINT_PROCESS_SLOTS,
      statusSlots: AHU_BLUEPRINT_STATUS_SLOTS,
    }
  );
}
