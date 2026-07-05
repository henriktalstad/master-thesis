import type { SdAnleggsenhet } from "./infer-anleggsenheter";
import type { SdDomainAnleggsenhet } from "./resolve-domain-anleggsenheter";

export type SdAnleggAnleggsenhetDisplayOverride = {
  /** `{sourceId}:{unitKey}` fra buildAnleggsenhetScopeId */
  scopeId: string;
  displayName: string;
};

function isAnleggsenhetDisplayOverride(
  value: unknown,
): value is SdAnleggAnleggsenhetDisplayOverride {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.scopeId === "string" &&
    typeof record.displayName === "string"
  );
}

export function parseAnleggsenhetDisplayOverrides(
  raw: unknown,
): SdAnleggAnleggsenhetDisplayOverride[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: SdAnleggAnleggsenhetDisplayOverride[] = [];

  for (const entry of raw) {
    if (!isAnleggsenhetDisplayOverride(entry)) continue;
    const scopeId = entry.scopeId.trim();
    const displayName = entry.displayName.trim();
    if (!scopeId || !displayName || seen.has(scopeId)) continue;
    seen.add(scopeId);
    result.push({ scopeId, displayName });
  }

  return result;
}

export function findAnleggsenhetDisplayOverride(
  overrides: readonly SdAnleggAnleggsenhetDisplayOverride[],
  scopeId: string,
): SdAnleggAnleggsenhetDisplayOverride | null {
  return overrides.find((entry) => entry.scopeId === scopeId) ?? null;
}

export function resolveAnleggsenhetDisplayName(
  scopeId: string,
  inferredName: string,
  overrides: readonly SdAnleggAnleggsenhetDisplayOverride[],
): string {
  const match = overrides.find((entry) => entry.scopeId === scopeId);
  return match?.displayName.trim() || inferredName;
}

export function withAnleggsenhetDisplayOverride<
  T extends Pick<SdAnleggsenhet, "id" | "displayName">,
>(unit: T, overrides: readonly SdAnleggAnleggsenhetDisplayOverride[]): T {
  const displayName = resolveAnleggsenhetDisplayName(
    unit.id,
    unit.displayName,
    overrides,
  );
  if (displayName === unit.displayName) return unit;
  return { ...unit, displayName };
}

export function applyAnleggsenhetDisplayOverridesToDomainEntries(
  entries: readonly SdDomainAnleggsenhet[],
  overrides: readonly SdAnleggAnleggsenhetDisplayOverride[],
): SdDomainAnleggsenhet[] {
  if (overrides.length === 0) return [...entries];
  return entries.map((entry) => ({
    ...entry,
    unit: withAnleggsenhetDisplayOverride(entry.unit, overrides),
  }));
}

export function upsertAnleggsenhetDisplayOverride(
  existing: readonly SdAnleggAnleggsenhetDisplayOverride[],
  scopeId: string,
  displayName: string,
): SdAnleggAnleggsenhetDisplayOverride[] {
  const trimmedScopeId = scopeId.trim();
  const trimmedName = displayName.trim();
  const without = existing.filter((entry) => entry.scopeId !== trimmedScopeId);
  if (!trimmedName) return without;
  return [...without, { scopeId: trimmedScopeId, displayName: trimmedName }];
}
