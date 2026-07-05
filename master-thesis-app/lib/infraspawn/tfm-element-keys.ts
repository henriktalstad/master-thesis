/** TFM `320002` / PA `3200001` — varme/fjernvarme-systemforekomst. */
export function isThermalSystemElementKey(elementKey: string): boolean {
  return /^320\d{3}$/.test(elementKey) || /^3200\d{3}$/.test(elementKey);
}
export function isVentilationSystemElementKey(elementKey: string): boolean {
  return /^360\d{3}$/.test(elementKey) || /^3600\d{3}$/.test(elementKey);
}

export function isSdAnleggsenhetElementKey(elementKey: string): boolean {
  return (
    isThermalSystemElementKey(elementKey) ||
    isVentilationSystemElementKey(elementKey)
  );
}

const THERMAL_ANLEGSENHET_DISPLAY_NAMES: Record<string, string> = {
  "320001": "Fjernvarme",
  "320002": "Boligdel",
  "320003": "Næringsdel",
  "3200001": "Fjernvarme",
  "3200002": "Boligdel",
  "3200003": "Næringsdel",
};

export function thermalAnleggsenhetDisplayLabel(
  unitKey: string,
): string | null {
  return THERMAL_ANLEGSENHET_DISPLAY_NAMES[unitKey] ?? null;
}

const THERMAL_VENTILATION_SIBLING_KEYS: Record<string, string> = {
  "320002": "360101",
  "320003": "360102",
};

function normalizeThermalUnitKeyForSiblingLookup(raw: string): string {
  const key = raw.replace(/[.\s]/g, "").toLowerCase();
  if (/^3200\d{3}$/.test(key)) {
    return `320${key.slice(-3)}`;
  }
  return key;
}
export function inferVentilationSiblingFromThermalUnitKey(
  thermalUnitKey: string,
): string | null {
  const normalized = normalizeThermalUnitKeyForSiblingLookup(thermalUnitKey);
  const sibling = THERMAL_VENTILATION_SIBLING_KEYS[normalized];
  return sibling && isVentilationSystemElementKey(sibling) ? sibling : null;
}

export function formatTfmElementKeyForDisplay(elementKey: string): string {
  if (/^\d{7}$/.test(elementKey) && elementKey.startsWith("3200")) {
    return `${elementKey.slice(0, 4)}.${elementKey.slice(4)}`;
  }
  if (/^\d{7}$/.test(elementKey) && elementKey.startsWith("3600")) {
    return `${elementKey.slice(0, 4)}.${elementKey.slice(4)}`;
  }
  if (/^\d{6}$/.test(elementKey)) {
    return `${elementKey.slice(0, 3)}.${elementKey.slice(3)}`;
  }
  return elementKey;
}

function normalizeElementKey(systemCode: string, elementNumber: string): string {
  return `${systemCode}${elementNumber}`.replace(/[.\s]/g, "");
}

export function formatSystemOccurrence(
  systemCode: string,
  elementNumber: string,
  subsystemSuffix?: string | null,
): string {
  const base = `${systemCode}.${elementNumber}`;
  return subsystemSuffix ? `${base}.${subsystemSuffix}` : base;
}

export { normalizeElementKey as normalizeTfmElementKey };
