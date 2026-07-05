export const STYRING_TABS = [
  {
    id: "na",
    label: "Styring",
    description:
      "Målt drift, estimert og simulert forslag — historikk, nå og plan",
  },
  {
    id: "analyse",
    label: "Effekt",
    description:
      "Besparelse, komfort og energi — simulert mot faktisk drift",
  },
  {
    id: "oppsett",
    label: "Oppsett",
    description:
      "Preferanser, signaldekning og teknisk dokumentasjon",
  },
] as const;

export type StyringTabId = (typeof STYRING_TABS)[number]["id"];

export const DEFAULT_STYRING_TAB: StyringTabId = "na";

/** @deprecated Bruk nye tab-ID-er — beholdt for URL-mapping. */
export const LEGACY_STYRING_TAB_IDS = [
  "resultater",
  "signaler",
  "forward",
  "plan",
  "preferanser",
  "system",
  "validering",
  "styring",
  "effekt",
] as const;

export type LegacyStyringTabId = (typeof LEGACY_STYRING_TAB_IDS)[number];

const LEGACY_TO_TAB: Record<LegacyStyringTabId, StyringTabId> = {
  resultater: "analyse",
  signaler: "analyse",
  forward: "na",
  plan: "na",
  preferanser: "oppsett",
  system: "oppsett",
  validering: "analyse",
  styring: "na",
  effekt: "analyse",
};

export function mapLegacyStyringTab(value: string): StyringTabId | null {
  if (value in LEGACY_TO_TAB) {
    return LEGACY_TO_TAB[value as LegacyStyringTabId];
  }
  return null;
}

export function parseStyringTab(value: string | undefined): StyringTabId {
  if (!value) return DEFAULT_STYRING_TAB;
  const legacy = mapLegacyStyringTab(value);
  if (legacy) return legacy;
  const match = STYRING_TABS.find((t) => t.id === value);
  return match?.id ?? DEFAULT_STYRING_TAB;
}

/** Om legacy `vis=` skal åpne en bestemt analyse-visning. */
export function legacyStyringAnalysisViewHint(
  value: string | undefined,
): "signaler" | null {
  if (value === "signaler" || value === "validering") return "signaler";
  return null;
}
