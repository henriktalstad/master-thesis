"use client";

import { useCallback, useMemo } from "react";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  applyPointMetadataOverridesToList,
  buildSchemaSlotOverrideMap,
  resolveEffectiveAnleggsenhetAssignments,
} from "@/lib/sd-anlegg/point-metadata-overrides";
import { useSdAnleggSiteProfile } from "./sd-anlegg-site-profile-context";

export function useSdAnleggEffectiveIdentification() {
  const profile = useSdAnleggSiteProfile();
  const overrides = useMemo(
    () => profile?.pointMetadataOverrides ?? [],
    [profile?.pointMetadataOverrides],
  );

  const effectiveAssignments = useMemo(
    () =>
      resolveEffectiveAnleggsenhetAssignments(
        profile?.anleggsenhetPointAssignments ?? [],
        overrides,
      ),
    [profile?.anleggsenhetPointAssignments, overrides],
  );

  const schemaSlotOverrides = useMemo(
    () => buildSchemaSlotOverrideMap(overrides),
    [overrides],
  );

  const applyToPoints = useCallback(
    (points: readonly InfraspawnPointListItem[]) =>
      applyPointMetadataOverridesToList(points, overrides),
    [overrides],
  );

  return {
    overrides,
    effectiveAssignments,
    schemaSlotOverrides,
    applyToPoints,
  };
}
