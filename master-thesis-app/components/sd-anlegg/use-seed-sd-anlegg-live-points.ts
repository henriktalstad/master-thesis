"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { sdAnleggQueryKeys } from "@/queries/infraspawn";

/** Seed QueryClient med SSR-snapshot når rute/bygg endres (overskriver gammel poll-cache). */
export function useSeedSdAnleggLivePoints(
  buildingSlug: string,
  initialPoints: readonly InfraspawnPointListItem[] | undefined,
): InfraspawnPointListItem[] | undefined {
  const queryClient = useQueryClient();
  const queryKey = sdAnleggQueryKeys.points(buildingSlug);
  const seeded = useMemo(
    () => (initialPoints?.length ? [...initialPoints] : undefined),
    [initialPoints],
  );
  const lastSeedKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!seeded || lastSeedKeyRef.current === buildingSlug) return;
    lastSeedKeyRef.current = buildingSlug;
    queryClient.setQueryData(queryKey, seeded);
  }, [buildingSlug, queryClient, queryKey, seeded]);

  return seeded;
}
