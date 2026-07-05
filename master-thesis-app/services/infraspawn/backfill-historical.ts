import { prisma } from "@/lib/db";
import { utcDayMidnight } from "@/lib/energy-prices/day-utils";
import {
  parseThesisEnvDate,
} from "@/lib/config/thesis-eval";
import { invokeCronJobHttp } from "@/lib/cron/http-client";

export type BackfillInfraspawnResult = {
  success: boolean;
  sourceId: string;
  targetStart: string;
  iterations: number;
  oldestSampleAt: string | null;
  watermarkAt: string | null;
  message: string;
};

function parseTargetStart(input?: Date): Date {
  if (input) return utcDayMidnight(input);
  const fromEnv =
    parseThesisEnvDate(process.env.INFRASPAWN_BACKFILL_START) ??
    parseThesisEnvDate(process.env.THESIS_EVAL_START);
  if (fromEnv) return fromEnv;
  const fallback = new Date();
  fallback.setUTCDate(fallback.getUTCDate() - 90);
  return utcDayMidnight(fallback);
}

async function oldestSampleAt(sourceId: string): Promise<Date | null> {
  const row = await prisma.infraspawnBacnetSample.findFirst({
    where: { sourceId },
    orderBy: { sampledAt: "asc" },
    select: { sampledAt: true },
  });
  return row?.sampledAt ?? null;
}

async function backfillOneSource(
  sourceId: string,
  options?: {
    targetStart?: Date;
    maxIterations?: number;
    resetWatermark?: boolean;
  },
): Promise<BackfillInfraspawnResult> {
  const targetStart = parseTargetStart(options?.targetStart);
  const maxIterations =
    options?.maxIterations ??
    Number(process.env.INFRASPAWN_BACKFILL_MAX_ITERATIONS ?? "25");

  const oldestBefore = await oldestSampleAt(sourceId);
  if (
    options?.resetWatermark !== false &&
    (!oldestBefore || oldestBefore.getTime() > targetStart.getTime())
  ) {
    await prisma.infraspawnSyncState.upsert({
      where: { sourceId },
      create: { sourceId, watermarkAt: targetStart, status: "SUCCESS" },
      update: { watermarkAt: targetStart, status: "SUCCESS", lastError: null },
    });
  }

  let iterations = 0;
  let lastWatermark: string | null = null;

  for (let i = 0; i < maxIterations; i++) {
    iterations += 1;
    const http = await invokeCronJobHttp("sync-infraspawn");
    if (!http.ok) {
      return {
        success: false,
        sourceId,
        targetStart: targetStart.toISOString(),
        iterations,
        oldestSampleAt: (await oldestSampleAt(sourceId))?.toISOString() ?? null,
        watermarkAt: lastWatermark,
        message: http.error ?? "sync-infraspawn feilet",
      };
    }

    const state = await prisma.infraspawnSyncState.findUnique({
      where: { sourceId },
      select: { watermarkAt: true },
    });
    lastWatermark = state?.watermarkAt?.toISOString() ?? lastWatermark;

    const oldest = await oldestSampleAt(sourceId);
    const caughtUp =
      state?.watermarkAt &&
      state.watermarkAt.getTime() >= Date.now() - 7 * 60 * 60 * 1000;
    const reachedTarget =
      oldest && oldest.getTime() <= targetStart.getTime() + 86_400_000;

    if (caughtUp && reachedTarget && oldest && state?.watermarkAt) {
      return {
        success: true,
        sourceId,
        targetStart: targetStart.toISOString(),
        iterations,
        oldestSampleAt: oldest.toISOString(),
        watermarkAt: state.watermarkAt.toISOString(),
        message: `Backfill OK — eldste sample ${oldest.toISOString().split("T")[0]}`,
      };
    }

    const body = http.body as { result?: { rowsUpserted?: number } } | null;
    if ((body?.result?.rowsUpserted ?? 0) === 0 && iterations > 3) {
      break;
    }
  }

  const oldest = await oldestSampleAt(sourceId);
  const state = await prisma.infraspawnSyncState.findUnique({
    where: { sourceId },
    select: { watermarkAt: true },
  });

  return {
    success: true,
    sourceId,
    targetStart: targetStart.toISOString(),
    iterations,
    oldestSampleAt: oldest?.toISOString() ?? null,
    watermarkAt: state?.watermarkAt?.toISOString() ?? lastWatermark,
    message: `Backfill delvis fullført etter ${iterations} iterasjoner`,
  };
}

export async function backfillInfraspawnHistorical(input?: {
  targetStart?: Date;
  maxIterations?: number;
  resetWatermark?: boolean;
}): Promise<{
  success: boolean;
  results: BackfillInfraspawnResult[];
  message: string;
}> {
  const sources = await prisma.infraspawnSource.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  if (!sources.length) {
    return { success: false, results: [], message: "Ingen aktive kilder" };
  }

  const results: BackfillInfraspawnResult[] = [];
  for (const { id } of sources) {
    results.push(await backfillOneSource(id, input));
  }

  const ok = results.every((r) => r.success);
  return {
    success: ok,
    results,
    message: ok
      ? `Backfill fullført for ${results.length} kilde(r)`
      : "Backfill feilet for minst én kilde",
  };
}
