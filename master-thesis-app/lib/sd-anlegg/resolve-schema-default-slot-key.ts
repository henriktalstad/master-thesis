import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { buildAhuPresentationModel } from "./ahu-equipment-identification";
import {
  buildHeatingCombinedPresentationModel,
  buildSumpPitsPresentationModel,
  buildTapWaterPresentationModel,
} from "./heating-process-presentation";
import { buildHeatingDistrictPresentationModel } from "./heating-district-presentation";
import {
  HEATING_DISTRICT_COMBINED_ID,
  HEATING_DISTRICT_SECONDARY_CIRCUIT_ID,
  HEATING_SUMP_PITS_ID,
  HEATING_TAPWATER_DHW_ID,
  VENTILATION_AHU_DUAL_DUCT_HRU_ID,
} from "./schema-template-ids";

function pointKey(point: Pick<InfraspawnPointListItem, "sourceId" | "objectId">) {
  return `${point.sourceId}:${point.objectId}`;
}

export function resolveSchemaDefaultSlotKey(input: {
  schemaTemplateId?: string | null;
  elementKey?: string | null;
  schemaSlotOverrides?: ReadonlyMap<string, string>;
  points: readonly InfraspawnPointListItem[];
}): string | null {
  if (input.points.length === 0) return null;

  if (input.schemaTemplateId === VENTILATION_AHU_DUAL_DUCT_HRU_ID) {
    const ahuModel = buildAhuPresentationModel(input.points, {
      elementKey: input.elementKey,
      schemaSlotOverrides: input.schemaSlotOverrides,
    });
    const firstWithPoint =
      ahuModel.processSlots.find((slot) => slot.primaryPoint) ??
      ahuModel.statusSlots.find((slot) => slot.primaryPoint);
    return firstWithPoint?.primaryPoint
      ? pointKey(firstWithPoint.primaryPoint)
      : null;
  }

  if (input.schemaTemplateId === HEATING_DISTRICT_COMBINED_ID) {
    const model = buildHeatingCombinedPresentationModel(input.points);
    const firstWithPoint =
      model.branches
        .flatMap((branch) => [
          branch.supplyTemp,
          branch.valve,
          branch.setpoint,
          branch.oe.supply,
        ])
        .find((slot) => slot.primaryPoint) ?? model.outdoorTemp;
    return firstWithPoint?.primaryPoint
      ? pointKey(firstWithPoint.primaryPoint)
      : null;
  }

  if (input.schemaTemplateId === HEATING_TAPWATER_DHW_ID) {
    const model = buildTapWaterPresentationModel(input.points);
    const firstWithPoint =
      [model.supplyTemp, model.valve, model.pump, model.setpoint].find(
        (slot) => slot.primaryPoint,
      ) ?? null;
    return firstWithPoint?.primaryPoint
      ? pointKey(firstWithPoint.primaryPoint)
      : null;
  }

  if (input.schemaTemplateId === HEATING_SUMP_PITS_ID) {
    const model = buildSumpPitsPresentationModel(input.points);
    const firstWithPoint =
      model.pits
        .flatMap((pit) => [pit.drift, pit.alarm])
        .find((slot) => slot.primaryPoint) ?? null;
    return firstWithPoint?.primaryPoint
      ? pointKey(firstWithPoint.primaryPoint)
      : null;
  }

  if (input.schemaTemplateId === HEATING_DISTRICT_SECONDARY_CIRCUIT_ID) {
    const heatingModel = buildHeatingDistrictPresentationModel(input.points, {
      elementKey: input.elementKey,
    });
    const firstWithPoint =
      heatingModel.lanes
        .flatMap((lane) => lane.slots)
        .find((slot) => slot.primaryPoint) ??
      heatingModel.statusSlots.find((slot) => slot.primaryPoint);
    return firstWithPoint?.primaryPoint
      ? pointKey(firstWithPoint.primaryPoint)
      : null;
  }

  return null;
}
