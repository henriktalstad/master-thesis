export type InfraspawnPointHaystackInput = {
  objectId: string;
  objectName: string | null;
  description: string | null;
  unit?: string | null;
};

/** FDV-beskrivelser fra SD-anlegg som styrker alias-matching når objectName er flatt. */
const FDV_DESCRIPTION_ALIAS_TOKENS: ReadonlyArray<{
  pattern: RegExp;
  tokens: readonly string[];
}> = [
  { pattern: /temp\.?\s*tilluft/i, tokens: ["supply", "temp_out", "tilluft", "RT401"] },
  { pattern: /temp\.?\s*avtrekk/i, tokens: ["exhaust", "temp", "avtrekk", "RT501"] },
  { pattern: /temp\.?\s*avkast/i, tokens: ["exhaust", "temp", "avkast"] },
  { pattern: /temp\.?\s*inn/i, tokens: ["supply", "temp", "inn"] },
  { pattern: /temp\.?\s*ut/i, tokens: ["temp", "ut"] },
  { pattern: /tilluftsvifte|tilluft\s*vifte/i, tokens: ["JV401", "supply", "fan", "flow"] },
  { pattern: /avtrekksvifte|avtrekk\s*vifte/i, tokens: ["JV501", "exhaust", "fan", "flow"] },
  { pattern: /tilluft\s*spjeld|spjeld\s*tilluft/i, tokens: ["QD401", "supply", "damper"] },
  { pattern: /avtrekk\s*spjeld|spjeld\s*avtrekk/i, tokens: ["QD501", "exhaust", "damper"] },
  { pattern: /frost\s*vakt|frostvakt/i, tokens: ["frost", "frostvakt", "frostprottemp"] },
  { pattern: /filter\s*vakt|filtervakt/i, tokens: ["filter", "filterguard", "filtervakt"] },
  { pattern: /system\s*status|systemstatus/i, tokens: ["systemstatus", "system", "status"] },
  { pattern: /tids\s*program|tidsprogram/i, tokens: ["tidsprogram", "schedule"] },
  { pattern: /sfp/i, tokens: ["sfp", "specific", "fan", "power"] },
  { pattern: /varmebatteri|varme\s*batteri/i, tokens: ["SB401", "heating", "battery"] },
  { pattern: /varmegjenvinner|vgx|roterende/i, tokens: ["LX471", "hr", "recovery"] },
  { pattern: /pådrag\s*gjenvinner/i, tokens: ["360102_lx471_c", "lx471_c", "lx471", "hastighet"] },
  { pattern: /virkningsgrad/i, tokens: ["360102_lx471_kv", "lx471_kv", "efficiency", "lx471"] },
  { pattern: /trykk/i, tokens: ["pressure", "trykk"] },
  { pattern: /fukt/i, tokens: ["humidity", "rh", "fukt"] },
];

export function resolveFdvDescriptionAliasTokens(
  description: string | null | undefined,
): string[] {
  if (!description?.trim()) return [];
  const tokens: string[] = [];
  for (const entry of FDV_DESCRIPTION_ALIAS_TOKENS) {
    if (entry.pattern.test(description)) {
      tokens.push(...entry.tokens);
    }
  }
  return tokens;
}

export function infraspawnPointHaystack(
  point: InfraspawnPointHaystackInput,
): string {
  const aliasTokens = resolveFdvDescriptionAliasTokens(point.description);
  return [
    point.objectId,
    point.objectName,
    point.description,
    ...aliasTokens,
    point.unit,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function infraspawnObjectPrefix(objectId: string): string {
  const match = /^([A-Za-z]+)/.exec(objectId.trim());
  return match?.[1]?.toUpperCase() ?? "";
}
