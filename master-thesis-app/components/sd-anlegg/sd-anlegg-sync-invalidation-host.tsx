"use client";

import { usePathname } from "next/navigation";
import { useSdAnleggSyncInvalidation } from "@/queries/infraspawn";
import { parseSdAnleggPathname } from "@/lib/sd-anlegg/anleggsenhet-routes";

const STYRING_SYNC_REVISION_POLL_MS = 60_000;

/** Holder React Query i sync med Postgres-mirror etter Infraspawn-sync. */
export function SdAnleggSyncInvalidationHost({
  buildingSlug,
}: {
  buildingSlug: string;
}) {
  const pathname = usePathname();
  const onStyring = parseSdAnleggPathname(pathname).segment === "styring";

  useSdAnleggSyncInvalidation(buildingSlug, {
    refetchInterval: onStyring ? STYRING_SYNC_REVISION_POLL_MS : undefined,
  });
  return null;
}
