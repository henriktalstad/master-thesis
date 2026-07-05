import { readFile } from "node:fs/promises";
import path from "node:path";

import { resolveThesisProcessedDir } from "./thesis-export-paths";

export type ThesisMetricsSnapshot = {
  evalStart?: string;
  evalEnd?: string;
  replaySummary?: { stepCount?: number };
};

export async function readMetricsSummarySnapshot(
  processedDir = resolveThesisProcessedDir(),
): Promise<ThesisMetricsSnapshot | null> {
  try {
    const raw = await readFile(
      path.join(processedDir, "metrics_summary.json"),
      "utf8",
    );
    return JSON.parse(raw) as ThesisMetricsSnapshot;
  } catch {
    return null;
  }
}

export function assertReportStepCount(
  report: { stepCount?: number; thesisComplete?: boolean } | null,
  expectedSteps: number,
  label: string,
): string | null {
  if (!report) return `${label} mangler`;
  if (report.stepCount !== expectedSteps) {
    return `${label}.stepCount=${report.stepCount ?? "?"} != forventet ${expectedSteps}`;
  }
  if (report.thesisComplete === false) {
    return `${label} er merket thesisComplete=false`;
  }
  return null;
}

export function assertEvalWindowMatch(
  report: { evalStart?: string; evalEnd?: string } | null,
  expected: { evalStart?: string; evalEnd?: string },
  label: string,
): string | null {
  if (!report?.evalStart || !report?.evalEnd) return null;
  if (
    expected.evalStart &&
    report.evalStart.slice(0, 10) !== expected.evalStart.slice(0, 10)
  ) {
    return `${label}.evalStart=${report.evalStart} != ${expected.evalStart}`;
  }
  if (
    expected.evalEnd &&
    report.evalEnd.slice(0, 16) !== expected.evalEnd.slice(0, 16)
  ) {
    return `${label}.evalEnd=${report.evalEnd} != ${expected.evalEnd}`;
  }
  return null;
}
