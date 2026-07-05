import "server-only";

import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import {
  parseScopeId,
  resolveElementKeyForScope,
  resolveSchemaTemplateForScope,
  type SchemaTemplate,
} from "./schema-templates";
import { resolveSdAnleggWorkspacePoints } from "./scope-workspace-points";

export type SdAnleggSchemaLoadContext = {
  buildingSlug: string;
  domain?: InfraspawnSystemDomain;
  unitObjectIds?: readonly string[];
  scopeId?: string;
  unitKey?: string;
};

export type SdAnleggSchemaContext = {
  schemaTemplate: SchemaTemplate | null;
  elementKey: string | null;
};

function resolveUnitKeyFromContext(
  context?: SdAnleggSchemaLoadContext,
): string | undefined {
  if (context?.unitKey) return context.unitKey;
  if (context?.scopeId) {
    return parseScopeId(context.scopeId)?.unitKey;
  }
  return undefined;
}

export function loadSdAnleggSchemaContextForBuilding(
  points: readonly InfraspawnPointListItem[],
  context?: SdAnleggSchemaLoadContext,
): SdAnleggSchemaContext {
  const unitKey = resolveUnitKeyFromContext(context);
  const templateContext = {
    domain: context?.domain,
    unitKey,
    scopeId: context?.scopeId,
  };

  const schemaTemplate = context?.domain
    ? resolveSchemaTemplateForScope(templateContext, points)
    : null;

  const elementKeyGuess = resolveElementKeyForScope(templateContext, points);
  const scopedPoints = resolveSdAnleggWorkspacePoints(points, {
    domain: context?.domain,
    unitObjectIds: context?.unitObjectIds,
    schemaTemplate,
    elementKey: elementKeyGuess,
    unitKey,
  });

  const elementKey = resolveElementKeyForScope(templateContext, scopedPoints);

  return { schemaTemplate, elementKey };
}
