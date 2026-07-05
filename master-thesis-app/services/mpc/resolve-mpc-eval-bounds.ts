import "server-only";

import { getThesisEvalWindow } from "@/lib/config/thesis-eval";
import { CONTROL_SIGNAL_CATALOG_360102 } from "@/lib/sd-anlegg/control/control-signal-catalog";
import { resolvePointForCatalogEntryInContext } from "@/lib/sd-anlegg/control/resolve-control-catalog";
import { prisma } from "@/lib/db";
import { MPC_U_MEAS_CANONICAL_SET } from "./mpc-canonicals";
import { loadMpcResolveContext } from "./load-mpc-resolve-context";
import { resolveMpcBuildingSource } from "./resolve-mpc-context";
import {
  resolveConfiguredEvalWindow as resolveConfiguredEvalWindowCore,
  sdStepEndFromSample,
} from "./mpc-eval-window-utils";

export type MpcEvalBounds = {
  evalStart: Date;
  evalEnd: Date;
  latestSdSampleAt: string | null;
  /** evalEnd begrenset av siste SD-prøve (ikke fast THESIS_EVAL_END / BHCC). */
  sdCapped: boolean;
};

export function resolveConfiguredEvalWindow(input?: {
  evalStart?: Date;
  evalEnd?: Date;
}): { evalStart: Date; evalEnd: Date } {
  const thesis = getThesisEvalWindow();
  return resolveConfiguredEvalWindowCore({
    evalStart: input?.evalStart,
    evalEnd: input?.evalEnd,
    thesisStart: thesis.start,
    thesisEnd: thesis.end,
  });
}

export {
  trimEvalEndToLastUMeasStep,
  trimEvalEndToMinOptimizablePct,
} from "./mpc-eval-window-utils";

export async function resolveLatestSdSampleEnd(input: {
  sourceId: string;
  objectIds: readonly string[];
  evalStart: Date;
  ceilingEnd: Date;
}): Promise<Date | null> {
  if (input.objectIds.length === 0) return null;

  const latest = await prisma.infraspawnBacnetSample.findFirst({
    where: {
      sourceId: input.sourceId,
      objectId: { in: [...input.objectIds] },
      resolution: "15m",
      sampledAt: { gte: input.evalStart, lte: input.ceilingEnd },
      valueNum: { not: null },
    },
    orderBy: { sampledAt: "desc" },
    select: { sampledAt: true },
  });

  return latest?.sampledAt ?? null;
}

async function resolveUMeasObjectIds(input: {
  buildingId: string;
  buildingSlug: string;
  sourceId: string;
}): Promise<string[]> {
  const mpcCtx = await loadMpcResolveContext({
    buildingId: input.buildingId,
    buildingSlug: input.buildingSlug,
    sourceId: input.sourceId,
  });

  const ids: string[] = [];
  for (const entry of CONTROL_SIGNAL_CATALOG_360102) {
    if (!MPC_U_MEAS_CANONICAL_SET.has(entry.canonicalId)) continue;
    const point = resolvePointForCatalogEntryInContext({
      points: mpcCtx.points,
      entry,
      context: mpcCtx,
    });
    if (point) ids.push(point.objectId);
  }
  return [...new Set(ids)];
}

/**
 * Eval-vindu styrt av SD i Postgres: fra THESIS_EVAL_START (eller input) til
 * siste 15-min uMeas-prøve — ikke BHCC eller fast sluttdato.
 */
export async function resolveMpcEvalBounds(input?: {
  buildingSlug?: string;
  evalStart?: Date;
  evalEnd?: Date;
  now?: Date;
}): Promise<MpcEvalBounds | null> {
  const now = input?.now ?? new Date();
  const thesis = getThesisEvalWindow();
  const configured = resolveConfiguredEvalWindowCore({
    evalStart: input?.evalStart,
    evalEnd: input?.evalEnd,
    thesisStart: thesis.start,
    thesisEnd: thesis.end,
    now,
  });
  const ctx = await resolveMpcBuildingSource({
    buildingSlug: input?.buildingSlug,
  });
  if (!ctx) return null;

  const uMeasObjectIds = await resolveUMeasObjectIds({
    buildingId: ctx.buildingId,
    buildingSlug: ctx.buildingSlug,
    sourceId: ctx.sourceId,
  });

  const latestSd = await resolveLatestSdSampleEnd({
    sourceId: ctx.sourceId,
    objectIds: uMeasObjectIds,
    evalStart: configured.evalStart,
    ceilingEnd: now,
  });

  if (!latestSd) {
    return {
      evalStart: configured.evalStart,
      evalEnd: configured.evalEnd,
      latestSdSampleAt: null,
      sdCapped: false,
    };
  }

  const sdStepEnd = sdStepEndFromSample(latestSd);
  let evalEnd = configured.evalEnd;
  let sdCapped = false;

  if (sdStepEnd.getTime() < evalEnd.getTime()) {
    evalEnd = sdStepEnd;
    sdCapped = true;
  }

  return {
    evalStart: configured.evalStart,
    evalEnd,
    latestSdSampleAt: latestSd.toISOString(),
    sdCapped,
  };
}
