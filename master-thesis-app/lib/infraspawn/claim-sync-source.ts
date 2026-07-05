import "server-only";

import { prisma } from "@/lib/db";

const STALE_RUNNING_MS = 20 * 60 * 1000;
export async function claimInfraspawnSourceSync(
  sourceId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - STALE_RUNNING_MS);

  const updated = await prisma.infraspawnSyncState.updateMany({
    where: {
      sourceId,
      OR: [{ status: { not: "RUNNING" } }, { lastRunAt: { lt: staleBefore } }],
    },
    data: {
      status: "RUNNING",
      lastRunAt: now,
      lastError: null,
    },
  });

  if (updated.count > 0) return true;

  const existing = await prisma.infraspawnSyncState.findUnique({
    where: { sourceId },
    select: { status: true, lastRunAt: true },
  });

  if (
    existing?.status === "RUNNING" &&
    existing.lastRunAt != null &&
    existing.lastRunAt.getTime() >= staleBefore.getTime()
  ) {
    return false;
  }

  if (existing) return false;

  try {
    await prisma.infraspawnSyncState.create({
      data: { sourceId, status: "RUNNING", lastRunAt: now },
    });
    return true;
  } catch {
    return false;
  }
}

export async function isInfraspawnSourceSyncActive(
  sourceId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const state = await prisma.infraspawnSyncState.findUnique({
    where: { sourceId },
    select: { status: true, lastRunAt: true },
  });
  if (!state?.lastRunAt || state.status !== "RUNNING") return false;
  return now.getTime() - state.lastRunAt.getTime() < STALE_RUNNING_MS;
}
