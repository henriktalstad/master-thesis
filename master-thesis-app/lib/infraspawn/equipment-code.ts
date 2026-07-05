export function isEnergyMeterEquipmentCode(
  equipmentCode: string | null | undefined,
): boolean {
  return equipmentCode?.toUpperCase()?.startsWith("OE") ?? false;
}
