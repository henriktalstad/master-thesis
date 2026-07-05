export const VENTILATION_AHU_DUAL_DUCT_HRU_ID = "ventilation.ahu.dual_duct_hru";
export const HEATING_DISTRICT_SECONDARY_CIRCUIT_ID =
  "heating.district.secondary_circuit";
export const HEATING_DISTRICT_COMBINED_ID = "heating.district.combined";
export const HEATING_TAPWATER_DHW_ID = "heating.tapwater.dhw";
export const HEATING_SUMP_PITS_ID = "heating.sump_pits";

export function isAhuProcessSchemaTemplate(
  schemaTemplateId?: string | null,
): boolean {
  return schemaTemplateId === VENTILATION_AHU_DUAL_DUCT_HRU_ID;
}

export function isHeatingDistrictSchemaTemplate(
  schemaTemplateId?: string | null,
): boolean {
  return (
    schemaTemplateId === HEATING_DISTRICT_SECONDARY_CIRCUIT_ID ||
    schemaTemplateId === HEATING_DISTRICT_COMBINED_ID ||
    schemaTemplateId === HEATING_TAPWATER_DHW_ID ||
    schemaTemplateId === HEATING_SUMP_PITS_ID
  );
}

export function isHeatingCombinedSchemaTemplate(
  schemaTemplateId?: string | null,
): boolean {
  return schemaTemplateId === HEATING_DISTRICT_COMBINED_ID;
}

export function isHeatingTapWaterSchemaTemplate(
  schemaTemplateId?: string | null,
): boolean {
  return schemaTemplateId === HEATING_TAPWATER_DHW_ID;
}

export function isHeatingSumpPitsSchemaTemplate(
  schemaTemplateId?: string | null,
): boolean {
  return schemaTemplateId === HEATING_SUMP_PITS_ID;
}

export function isSdAnleggProcessSchemaTemplate(
  schemaTemplateId?: string | null,
): boolean {
  return (
    isAhuProcessSchemaTemplate(schemaTemplateId) ||
    isHeatingDistrictSchemaTemplate(schemaTemplateId)
  );
}
