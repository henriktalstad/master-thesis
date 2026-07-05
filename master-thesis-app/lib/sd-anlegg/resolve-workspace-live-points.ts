import type { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  getSchemaTemplateById,
  resolveElementKeyForScope,
  resolveSchemaTemplateForScope,
} from "@/lib/sd-anlegg/schema-templates";
import { resolveSdAnleggWorkspacePoints } from "@/lib/sd-anlegg/scope-workspace-points";

export type WorkspaceLiveScopeInput = {
  domain?: InfraspawnSystemDomain;
  unitObjectIds?: readonly string[];
  scopeId?: string;
  unitKey?: string;
  schemaTemplateId?: string | null;
};

export function applyWorkspaceLivePointScope(
  points: readonly InfraspawnPointListItem[],
  input: WorkspaceLiveScopeInput,
): InfraspawnPointListItem[] {
  const scopePointsForInference =
    input.unitObjectIds?.length ?
      points.filter((point) => input.unitObjectIds!.includes(point.objectId))
    : points;

  const schemaTemplate =
    input.schemaTemplateId ?
      getSchemaTemplateById(input.schemaTemplateId)
    : resolveSchemaTemplateForScope(
        {
          domain: input.domain,
          unitKey: input.unitKey,
          scopeId: input.scopeId,
        },
        scopePointsForInference,
      );

  const elementKey = resolveElementKeyForScope(
    { domain: input.domain, unitKey: input.unitKey, scopeId: input.scopeId },
    scopePointsForInference,
  );

  return resolveSdAnleggWorkspacePoints(points, {
    domain: input.domain,
    unitObjectIds: input.unitObjectIds,
    schemaTemplate,
    elementKey,
    unitKey: input.unitKey,
  });
}
