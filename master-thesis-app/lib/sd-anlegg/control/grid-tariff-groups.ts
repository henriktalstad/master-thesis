/** NVE tariffgrupper — energiledd (typ. 2) og effektledd (typ. 3) lagres separat. */
export const DEFAULT_GRID_TARIFF_GROUPS = [2, 3] as const;

export function parseGridTariffGroups(): number[] {
  const raw = process.env.GRID_TARIFF_GROUPS?.trim();
  if (!raw) return [...DEFAULT_GRID_TARIFF_GROUPS];
  const groups = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return groups.length ? groups : [...DEFAULT_GRID_TARIFF_GROUPS];
}

/** Energiledd (øre/kWh) — laveste gruppe med data, typ. 2. */
export function primaryEnergyTariffGroup(): number {
  return parseGridTariffGroups()[0] ?? 2;
}
