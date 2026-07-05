import { isSdAnleggsenhetElementKey } from "@/lib/infraspawn/tfm-element-keys";
import { parseInfraspawnPointIdentity } from "@/lib/infraspawn/parse-infraspawn-point-identity";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import {
  parseAnleggsenhetScopeId,
  SD_ANLEGG_SOURCE_UNIT_KEY,
  SD_ANLEGG_UNGROUPED_UNIT_KEY,
  normalizeAnleggsenhetUnitKey,
} from "../infer-anleggsenheter";
import { HEATING_DISTRICT_SECONDARY_CIRCUIT } from "./templates/heating.district.secondary_circuit";
import { HEATING_DISTRICT_COMBINED } from "./templates/heating.district.combined";
import { HEATING_TAPWATER_DHW } from "./templates/heating.tapwater.dhw";
import { HEATING_SUMP_PITS } from "./templates/heating.sump_pits";
import { VENTILATION_AHU_DUAL_DUCT_HRU } from "./templates/ventilation.ahu.dual_duct_hru";
import type { SchemaTemplate, TemplateResolveContext } from "./types";
import {
  HEATING_DISTRICT_COMBINED_UNIT_KEY,
  HEATING_SUMP_PITS_UNIT_KEY,
  HEATING_TAPWATER_UNIT_KEY,
} from "../heating-process-units";

export const SCHEMA_TEMPLATES: readonly SchemaTemplate[] = [
  VENTILATION_AHU_DUAL_DUCT_HRU,
  HEATING_DISTRICT_SECONDARY_CIRCUIT,
  HEATING_DISTRICT_COMBINED,
  HEATING_TAPWATER_DHW,
  HEATING_SUMP_PITS,
];

export function parseScopeId(scopeId: string) {
  return parseAnleggsenhetScopeId(scopeId);
}

export function inferElementKeyFromUnitKey(unitKey: string): string | null {
  const normalized = normalizeAnleggsenhetUnitKey(unitKey);
  if (normalized === SD_ANLEGG_SOURCE_UNIT_KEY) return null;
  if (normalized === SD_ANLEGG_UNGROUPED_UNIT_KEY) return null;
  if (normalized === HEATING_DISTRICT_COMBINED_UNIT_KEY) return null;
  if (normalized === HEATING_TAPWATER_UNIT_KEY) return normalized;
  if (normalized === HEATING_SUMP_PITS_UNIT_KEY) return normalized;
  return isSdAnleggsenhetElementKey(normalized) ? normalized : null;
}

export function inferElementKeyFromPoints(
  points: readonly InfraspawnPointListItem[],
): string | null {
  const counts = new Map<string, number>();
  for (const point of points) {
    const identity = parseInfraspawnPointIdentity(point);
    if (!identity?.elementKey) continue;
    counts.set(identity.elementKey, (counts.get(identity.elementKey) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

export function resolveElementKeyForScope(
  context: TemplateResolveContext,
  points: readonly InfraspawnPointListItem[],
): string | null {
  if (context.elementKey) return context.elementKey;

  if (context.unitKey) {
    const fromUnit = inferElementKeyFromUnitKey(context.unitKey);
    if (fromUnit) return fromUnit;
  }

  if (context.scopeId) {
    const parsed = parseScopeId(context.scopeId);
    if (parsed?.unitKey) {
      const fromScope = inferElementKeyFromUnitKey(parsed.unitKey);
      if (fromScope) return fromScope;
    }
  }

  return inferElementKeyFromPoints(points);
}

function resolveUnitKeyForTemplate(context: TemplateResolveContext): string | undefined {
  if (context.unitKey) return context.unitKey;
  if (context.scopeId) {
    return parseScopeId(context.scopeId)?.unitKey;
  }
  return undefined;
}

function resolveCuratedHeatingTemplateByUnitKey(
  unitKey: string | undefined,
): SchemaTemplate | null {
  if (!unitKey) return null;
  if (unitKey === HEATING_DISTRICT_COMBINED_UNIT_KEY) {
    return HEATING_DISTRICT_COMBINED;
  }
  if (unitKey === HEATING_TAPWATER_UNIT_KEY) {
    return HEATING_TAPWATER_DHW;
  }
  if (unitKey === HEATING_SUMP_PITS_UNIT_KEY) {
    return HEATING_SUMP_PITS;
  }
  return null;
}

function templateMatchesDomain(
  template: SchemaTemplate,
  domain: InfraspawnSystemDomain,
): boolean {
  return template.domains.includes(domain);
}

function templateMatchesElementKey(
  template: SchemaTemplate,
  elementKey: string | null,
): boolean {
  if (!template.elementKeyHint || template.elementKeyHint.length === 0) {
    return true;
  }
  if (!elementKey) return true;
  return template.elementKeyHint.some(
    (hint) => normalizeAnleggsenhetUnitKey(hint) === elementKey,
  );
}

export function resolveSchemaTemplateForScope(
  context: TemplateResolveContext,
  points: readonly InfraspawnPointListItem[] = [],
): SchemaTemplate | null {
  if (!context.domain) return null;

  const unitKey = resolveUnitKeyForTemplate(context);

  if (context.domain === InfraspawnSystemDomain.HEATING) {
    const curated = resolveCuratedHeatingTemplateByUnitKey(unitKey);
    if (curated) return curated;
  }

  const elementKey = resolveElementKeyForScope(context, points);

  const candidates = SCHEMA_TEMPLATES.filter(
    (template) =>
      templateMatchesDomain(template, context.domain!) &&
      templateMatchesElementKey(template, elementKey),
  );

  if (candidates.length === 0) return null;

  if (context.domain === InfraspawnSystemDomain.VENTILATION) {
    return (
      candidates.find((t) => t.id === VENTILATION_AHU_DUAL_DUCT_HRU.id) ?? null
    );
  }

  if (context.domain === InfraspawnSystemDomain.HEATING) {
    return (
      candidates.find((t) => t.id === HEATING_DISTRICT_SECONDARY_CIRCUIT.id) ??
      null
    );
  }

  return candidates[0] ?? null;
}

export function getSchemaTemplateById(id: string): SchemaTemplate | null {
  return SCHEMA_TEMPLATES.find((template) => template.id === id) ?? null;
}
