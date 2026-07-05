import "server-only";

import {
  getSdCoverageThreshold,
  getThesisEvalWindow,
} from "@/lib/config/thesis-eval";
import { findEvalStartMeetingCoverage } from "./analyze-eval-coverage";
import { loadEvalDatasetForMpc } from "./load-eval-dataset";
import {
  resolveMpcEvalBounds,
  trimEvalEndToLastUMeasStep,
} from "./resolve-mpc-eval-bounds";

export type ResolvedEvalWindow = {
  evalStart: Date;
  evalEnd: Date;
  clipped: boolean;
  actions: string[];
  stepCount: number | null;
  uMeasPct: number | null;
  latestSdSampleAt: string | null;
};

/**
 * Klipper eval-vindu til tidligste start med tilstrekkelig uMeas-dekning
 * og siste SD-måling i Postgres (15-min grid).
 */
export async function resolveEffectiveEvalWindowForMpc(input?: {
  buildingSlug?: string;
  configuredStart?: Date;
  configuredEnd?: Date;
  thresholdPct?: number;
}): Promise<ResolvedEvalWindow> {
  const thesis = getThesisEvalWindow();
  const configuredStart =
    input?.configuredStart ??
    thesis.start ??
    new Date(Date.now() - 14 * 86400000);

  const sdBounds = await resolveMpcEvalBounds({
    buildingSlug: input?.buildingSlug,
    evalStart: configuredStart,
    evalEnd: input?.configuredEnd,
  });

  const configuredEnd = sdBounds?.evalEnd ?? input?.configuredEnd ?? new Date();
  const actions: string[] = [];
  let evalStart = configuredStart;
  let evalEnd = configuredEnd;
  let clipped = sdBounds?.sdCapped ?? false;
  const latestSdSampleAt = sdBounds?.latestSdSampleAt ?? null;

  if (sdBounds?.sdCapped && latestSdSampleAt) {
    actions.push(
      `Eval-slutt satt til siste SD-måling (${latestSdSampleAt.slice(0, 16).replace("T", " ")})`,
    );
  }

  const clipStart = await findEvalStartMeetingCoverage({
    buildingSlug: input?.buildingSlug,
    configuredStart,
    evalEnd,
    thresholdPct: input?.thresholdPct,
    useFullDataset: true,
  });

  if (
    clipStart &&
    clipStart.evalStart.getTime() > configuredStart.getTime()
  ) {
    evalStart = clipStart.evalStart;
    clipped = true;
    actions.push(
      `Eval-start klippet ${configuredStart.toISOString().slice(0, 10)} → ${clipStart.evalStart.toISOString().slice(0, 10)} (${Math.round(clipStart.uMeasPct * 100)} % uMeas, ${clipStart.stepCount} steg)`,
    );
  }

  const dataset = await loadEvalDatasetForMpc({
    buildingSlug: input?.buildingSlug,
    evalStart,
    evalEnd,
  });

  if (!dataset || dataset.steps.length === 0) {
    return {
      evalStart,
      evalEnd,
      clipped,
      actions,
      stepCount: dataset?.steps.length ?? null,
      uMeasPct: dataset?.coverage
        ? dataset.coverage.stepsWithUMeas / Math.max(1, dataset.coverage.stepCount)
        : null,
      latestSdSampleAt,
    };
  }

  const trimmedEnd = trimEvalEndToLastUMeasStep({
    evalEnd,
    steps: dataset.steps,
  });
  if (trimmedEnd.trimmed) {
    evalEnd = trimmedEnd.evalEnd;
    clipped = true;
    actions.push(
      `Eval-slutt trimmet til siste komplette uMeas-steg (${evalEnd.toISOString().slice(0, 10)})`,
    );
  }

  const uMeasPct =
    dataset.coverage.stepCount > 0
      ? dataset.coverage.stepsWithUMeas / dataset.coverage.stepCount
      : 0;
  const threshold = input?.thresholdPct ?? getSdCoverageThreshold();

  if (uMeasPct < threshold && clipStart) {
    evalStart = clipStart.evalStart;
  }

  const finalDataset = await loadEvalDatasetForMpc({
    buildingSlug: input?.buildingSlug,
    evalStart,
    evalEnd,
  });

  return {
    evalStart,
    evalEnd,
    clipped,
    actions,
    stepCount: finalDataset?.steps.length ?? dataset.steps.length,
    uMeasPct: finalDataset
      ? finalDataset.coverage.stepsWithUMeas /
        Math.max(1, finalDataset.coverage.stepCount)
      : uMeasPct,
    latestSdSampleAt,
  };
}
