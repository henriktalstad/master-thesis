import type { MpcPipelineResult } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcPipelineRunRecord } from "@/lib/sd-anlegg/control/control-types";

const COST_TOLERANCE_PCT = 0.05;

export type DbExportVerification = {
  ok: boolean;
  issues: string[];
};

/** Sammenlign DB-run mot fersk minne-replay uten å overskrive data/processed/. */
export function verifyDbRunMatchesMemoryReplay(input: {
  run: MpcPipelineRunRecord;
  result: MpcPipelineResult;
}): DbExportVerification {
  const issues: string[] = [];
  const mem = input.result.replay.summary;
  const db = input.run.snapshot.replaySummary;

  if (db.stepCount !== mem.stepCount) {
    issues.push(`stepCount DB=${db.stepCount} minne=${mem.stepCount}`);
  }
  if (
    Math.abs((db.deltaCostPct ?? 0) - mem.deltaCostPct) > COST_TOLERANCE_PCT
  ) {
    issues.push(
      `deltaCostPct DB=${db.deltaCostPct}% minne=${mem.deltaCostPct}%`,
    );
  }
  if (
    Math.abs((db.deltaCostVsEmulatedPct ?? 0) - mem.deltaCostVsEmulatedPct) >
    COST_TOLERANCE_PCT
  ) {
    issues.push(
      `deltaCostVsEmulatedPct DB=${db.deltaCostVsEmulatedPct}% minne=${mem.deltaCostVsEmulatedPct}%`,
    );
  }
  if (db.fallbackSteps !== mem.fallbackSteps) {
    issues.push(
      `fallbackSteps DB=${db.fallbackSteps} minne=${mem.fallbackSteps}`,
    );
  }

  return { ok: issues.length === 0, issues };
}
