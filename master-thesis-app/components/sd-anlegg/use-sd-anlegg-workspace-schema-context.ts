"use client";

import { getSchemaTemplateById, resolveElementKeyForScope, resolveSchemaTemplateForScope } from "@/lib/sd-anlegg/schema-templates";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getSdAnleggSchemaContextAction } from "@/actions/infraspawn-read";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import { sdAnleggQueryKeys } from "@/queries/infraspawn";

type Input = {
  buildingSlug: string;
  domain?: InfraspawnSystemDomain;
  unitObjectIds?: readonly string[];
  scopeId?: string;
  unitKey?: string;
  scopePointsForInference: readonly InfraspawnPointListItem[];
  pointsScopeKey: string;
};

export function useSdAnleggWorkspaceSchemaContext({
  buildingSlug,
  domain,
  unitObjectIds,
  scopeId,
  unitKey,
  scopePointsForInference,
  pointsScopeKey,
}: Input) {
  const { data: schemaData } = useQuery({
    queryKey: sdAnleggQueryKeys.schemaContext(buildingSlug, pointsScopeKey),
    queryFn: async () => {
      const res = await getSdAnleggSchemaContextAction(buildingSlug, {
        domain,
        unitObjectIds: unitObjectIds ? [...unitObjectIds] : undefined,
        scopeId,
        unitKey,
      });
      if (!res.success) throw new Error(res.error ?? "Kunne ikke laste skjema");
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const scope = { domain, unitKey, scopeId };
  const resolvedTemplate = resolveSchemaTemplateForScope(
    scope,
    scopePointsForInference,
  );
  const schemaTemplate =
    resolvedTemplate ??
    (schemaData?.schemaTemplateId
      ? getSchemaTemplateById(schemaData.schemaTemplateId)
      : null);

  const elementKey =
    schemaData?.elementKey ?? resolveElementKeyForScope(scope, scopePointsForInference);

  return {
    schemaTemplate,
    elementKey,
  };
}
