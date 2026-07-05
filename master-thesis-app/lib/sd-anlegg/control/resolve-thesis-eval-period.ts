import { getThesisEvalPeriodEndLabel } from "@/lib/config/thesis-eval";
import type {
  MpcEvalCoverageSummary,
  MpcPipelineRunRecord,
  ThesisEvalPeriod,
} from "./control-types";

const REPLAY_LAG_MS = 15 * 60 * 1000;

function parseIso(value: string): Date {
  return new Date(value);
}

function capToNow(value: Date, now: Date): Date {
  return value.getTime() > now.getTime() ? now : value;
}

export function resolveThesisEvalPeriod(input: {
  mpcPipelineRun: MpcPipelineRunRecord | null;
  coverage: MpcEvalCoverageSummary | null;
  replayPersistedStepCount?: number | null;
  now?: Date;
}): ThesisEvalPeriod | null {
  const now = input.now ?? new Date();
  const periodEnd = getThesisEvalPeriodEndLabel();
  const snapshot = input.mpcPipelineRun?.snapshot ?? null;

  const evalStart = snapshot?.evalStart ?? input.coverage?.evalStart ?? null;
  if (!evalStart) return null;

  const snapshotEndRaw = snapshot?.evalEnd ?? null;
  const snapshotEnd = snapshotEndRaw
    ? capToNow(parseIso(snapshotEndRaw), now)
    : null;

  const coverageEndRaw = input.coverage?.evalEnd ?? null;
  const coverageEnd = coverageEndRaw
    ? capToNow(parseIso(coverageEndRaw), now)
    : null;

  const evalEndDate = coverageEnd ?? snapshotEnd ?? now;
  const evalEnd = evalEndDate.toISOString();

  const expectedStepCount =
    input.coverage?.stepCount ?? snapshot?.stepCount ?? 0;
  const replayStepCount =
    input.replayPersistedStepCount ??
    snapshot?.stepCount ??
    null;

  const replayBehindEval =
    snapshotEnd != null &&
    evalEndDate.getTime() > snapshotEnd.getTime() + REPLAY_LAG_MS;

  return {
    evalStart,
    evalEnd,
    evalEndSnapshot: snapshotEndRaw,
    periodEnd,
    stepCount: expectedStepCount,
    replayStepCount,
    replayBehindEval,
    source: snapshot ? "db" : null,
    mpcRunId: input.mpcPipelineRun?.id ?? null,
  };
}
