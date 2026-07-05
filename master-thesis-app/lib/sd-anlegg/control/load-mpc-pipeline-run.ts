import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";
import type { MpcPipelineRunRecord } from "./control-types";
import {
  mapMpcPipelineRunRecord,
  mpcPipelineRunScalarSelect,
  type MpcPipelineRunRow,
} from "./map-mpc-pipeline-run-record";
import { loadPipelineReplaySteps } from "./persist-mpc-pipeline-replay-steps";
import { loadPolicyKpisForRun } from "./persist-mpc-pipeline-relational-artifacts";

const RUN_SELECT = mpcPipelineRunScalarSelect;

async function rowToRecord(
  row: MpcPipelineRunRow,
  includeReplaySteps: boolean,
): Promise<MpcPipelineRunRecord> {
  const [replaySteps, policyKpis] = await Promise.all([
    includeReplaySteps
      ? loadPipelineReplaySteps({ pipelineRunId: row.id })
      : Promise.resolve([]),
    loadPolicyKpisForRun(row.id),
  ]);
  return mapMpcPipelineRunRecord(row, replaySteps, { policySummaries: policyKpis });
}

async function fetchLatestMpcPipelineRun(
  buildingId: string,
  forPage: boolean,
): Promise<MpcPipelineRunRecord | null> {
  const row = await prisma.sdAnleggMpcPipelineRun.findFirst({
    where: { buildingId },
    orderBy: [{ stepCount: "desc" }, { createdAt: "desc" }],
    select: RUN_SELECT,
  });
  if (!row) return null;
  return rowToRecord(row, !forPage);
}

async function fetchMpcPipelineRunById(
  runId: string,
): Promise<MpcPipelineRunRecord | null> {
  const row = await prisma.sdAnleggMpcPipelineRun.findUnique({
    where: { id: runId },
    select: RUN_SELECT,
  });
  if (!row) return null;
  return rowToRecord(row, true);
}

export const loadLatestMpcPipelineRunForPage = cache(
  (buildingId: string) => fetchLatestMpcPipelineRun(buildingId, true),
);

export const loadLatestMpcPipelineRun = cache((buildingId: string) =>
  fetchLatestMpcPipelineRun(buildingId, false),
);

export const loadLatestMpcPipelineRunForExport = (buildingId: string) =>
  fetchLatestMpcPipelineRun(buildingId, false);

export const loadMpcPipelineRunByIdForExport = fetchMpcPipelineRunById;

export async function loadMpcReplayStepsTail(
  buildingId: string,
  maxSteps = 384,
): Promise<import("@/lib/sd-anlegg/mpc/shared/types").MpcReplayStep[]> {
  const row = await prisma.sdAnleggMpcPipelineRun.findFirst({
    where: { buildingId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!row) return [];
  return loadPipelineReplaySteps({
    pipelineRunId: row.id,
    maxSteps,
  });
}
