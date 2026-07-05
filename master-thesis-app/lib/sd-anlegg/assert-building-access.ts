import "server-only";

import { notFound } from "next/navigation";
import { resolveInfraspawnBuildingForRead } from "@/lib/infraspawn/read-access";

export async function assertSdAnleggBuildingAccess(
  buildingSlug: string,
): Promise<void> {
  const access = await resolveInfraspawnBuildingForRead(buildingSlug);
  if (!access.ok) notFound();
}
