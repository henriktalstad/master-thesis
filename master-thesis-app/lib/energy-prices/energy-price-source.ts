import { EnergyPriceSource } from "@/generated/client/enums";

/** Nord Pool / spotpriser.csv – skal ikke overskrives av ENTSO-E. */
export function isNordPoolProtectedSource(
  source: EnergyPriceSource | null | undefined,
): boolean {
  return source === EnergyPriceSource.NORD_POOL;
}

/** ENTSO-E kan oppdatere egne rader på nytt (daglig sync). */
export function isEntsoeOwnedSource(
  source: EnergyPriceSource | null | undefined,
): boolean {
  return source === EnergyPriceSource.ENTSOE;
}

/**
 * Kan innkommende ENTSO-E skrive denne slotten?
 * - Ny rad: ja
 * - Eksisterende ENTSOE: ja (oppdater)
 * - Eksisterende NORD_POOL: nei
 * - Eksisterende null (legacy): nei (bevar til CSV tar slotten)
 */
export function canEntsoeWriteExistingSource(
  existing: EnergyPriceSource | null | undefined,
): boolean {
  if (existing == null) return false;
  return isEntsoeOwnedSource(existing);
}

/**
 * Kan innkommende Nord Pool/CSV skrive slotten (fill-gaps)?
 * - Mangler rad: ja
 * - ENTSOE: ja (erstatt med autoritativ CSV)
 * - null (legacy): ja – CSV-eksport merkes som NORD_POOL
 * - NORD_POOL med gyldig pris: nei
 */
export function canNordPoolFillGapsWriteExisting(
  existing: EnergyPriceSource | null | undefined,
  existingPriceValid: boolean,
): boolean {
  if (isNordPoolProtectedSource(existing) && existingPriceValid) return false;
  return true;
}
