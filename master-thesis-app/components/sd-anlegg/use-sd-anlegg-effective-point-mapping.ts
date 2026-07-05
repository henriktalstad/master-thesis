"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { buildInfraspawnPointDisplayMapping } from "@/lib/infraspawn/build-infraspawn-point-display-mapping";
import { parseSdAnleggPathname } from "@/lib/sd-anlegg/anleggsenhet-routes";
import type { SdAnleggFeaturedPointRef } from "@/lib/sd-anlegg/site-profile-schema";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { useSdAnleggPoints } from "@/queries/infraspawn";
import { useSdAnleggSiteProfile } from "./sd-anlegg-site-profile-context";

export type SdAnleggEffectivePointMapping = {
  featuredPointRefs: SdAnleggFeaturedPointRef[];
  pointDisplayOverrides: SdAnleggFeaturedPointRef[];
  livePoints: InfraspawnPointListItem[] | undefined;
};

export function useSdAnleggEffectivePointMapping(
  buildingSlug: string,
): SdAnleggEffectivePointMapping {
  const profile = useSdAnleggSiteProfile();
  const pathname = usePathname();
  const onStyring = parseSdAnleggPathname(pathname).segment === "styring";
  const { data: livePoints } = useSdAnleggPoints(buildingSlug, {
    refetchInterval: onStyring ? false : undefined,
  });

  return useMemo(() => {
    const manualFeatured = profile?.featuredPointRefs ?? [];
    const manualOverrides = profile?.pointDisplayOverrides ?? [];

    if (!livePoints?.length) {
      return {
        featuredPointRefs: manualFeatured,
        pointDisplayOverrides: manualOverrides,
        livePoints,
      };
    }

    const mapping = buildInfraspawnPointDisplayMapping({
      points: livePoints,
      manualOverrides,
      manualFeatured,
    });

    return {
      ...mapping,
      livePoints,
    };
  }, [livePoints, profile?.featuredPointRefs, profile?.pointDisplayOverrides]);
}
