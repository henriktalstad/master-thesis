export type FdvSignalRegistryEntry = {
  match: string | RegExp;
  role: string;
};

export const FDV_SIGNAL_REGISTRY: readonly FdvSignalRegistryEntry[] = [
  { match: "310.001RT402_MV", role: "Tur tappevann" },
  { match: "310.001RT402_SP", role: "Settpunkt tappevann (TR001)" },
  { match: "310.001SB501_C", role: "Tappevannsventil" },
  { match: "310.001JP501_A", role: "Tappevannspumpe drift" },
  { match: "310.001JP501_S", role: "Tappevannspumpe status" },
  { match: "310.001JP501_KOM", role: "Tappevannspumpe kommando" },
  { match: "320.001RT901_MV", role: "Utetemperatur fasade" },
  { match: "320.002RT402_SPK", role: "Settpunkt tur bolig (TR002)" },
  { match: "320.003RT402_SPK", role: "Settpunkt tur næring (TR003)" },
  { match: /^310\.001RT402/i, role: "TR001 tappevann tur" },
  { match: /^310\.001SB501/i, role: "TR001 tappevann ventil (SB501)" },
  { match: /^310\.001JP501/i, role: "TR001 tappevannspumpe" },
  { match: /^320\.001RT901/i, role: "Utekompensering (TR002/TR003)" },
  { match: /^320\.002RT402/i, role: "TR002 bolig tur" },
  { match: /^320\.003RT402/i, role: "TR003 næring tur" },
  { match: /^320\.002SB502/i, role: "TR002 bolig ventil" },
  { match: /^320\.003SB502/i, role: "TR003 næring ventil" },
  { match: /^320\.002JP40/i, role: "TR002 bolig pumpe" },
  { match: /^320\.003JP40/i, role: "TR003 næring pumpe" },
  { match: /^320001OE001/i, role: "Fjernvarmemåler bolig (WM001)" },
  { match: /^320003OE001/i, role: "Fjernvarmemåler næring (WM001)" },
  { match: /^542\.00/i, role: "Brannsentral signal" },
  { match: /^690\.001/i, role: "Utvendig varmekabel" },
  { match: /^362\.001/i, role: "Heissjakt temperatur" },
  { match: /^310\.010JP/i, role: "Dykkpumpe pumpekum" },
];

export function resolveFdvSignalRole(input: {
  objectName?: string | null;
  objectId?: string | null;
  description?: string | null;
}): string | null {
  const ref = (input.objectName ?? input.objectId ?? "").trim();
  if (!ref) {
    return input.description?.trim() ?? null;
  }

  for (const entry of FDV_SIGNAL_REGISTRY) {
    if (typeof entry.match === "string") {
      if (ref === entry.match) return entry.role;
      continue;
    }
    if (entry.match.test(ref)) return entry.role;
  }

  return input.description?.trim() ?? null;
}

export const HEATING_EXACT_POINT_LABELS: Record<string, string> = Object.fromEntries(
  FDV_SIGNAL_REGISTRY.filter(
    (entry): entry is FdvSignalRegistryEntry & { match: string } =>
      typeof entry.match === "string",
  ).map((entry) => [entry.match, entry.role]),
);

export function resolveHeatingExactPointLabel(objectName: string): string | null {
  return HEATING_EXACT_POINT_LABELS[objectName] ?? null;
}
