import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { getDefaultBuildingSlug } from "@/lib/config/env";
import { prisma } from "@/lib/db";
import { buildMpcForwardPlanBundleForBuilding } from "@/lib/sd-anlegg/control/build-mpc-forward-plan-for-building";
import { loadLatestMpcPipelineRun } from "@/lib/sd-anlegg/control/load-mpc-pipeline-run";
import { loadPersistedMpcForwardPlan } from "@/lib/sd-anlegg/control/persist-mpc-forward-plan";
import {
  assessControlTickTrigger,
  buildForwardPlanDiff,
  buildLiveMultiPolicyStep,
  buildPolicyForwardPlans,
  loadControlLoopStepsTail,
  loadControlTickWorkspace,
  loadLiveControlObservation,
  mergeLiveObservationIntoTimestep,
  persistControlTickResult,
} from "@/lib/sd-anlegg/control/live";
import { pickReplayStepsForForwardPlan } from "@/lib/sd-anlegg/control/resolve-mpc-initial-control";
import { loadControlWeatherForecast } from "@/lib/sd-anlegg/control/load-control-weather-forecast";
import { controlHourKeyFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import { resolveComfortBandForStepWithOccupancy } from "@/lib/sd-anlegg/mpc/config/comfort-schedule";
import { preferenceTemplateForBuilding } from "@/lib/sd-anlegg/mpc/config/buildings/naerbyen-360102-preferences";
import {
  NAERBYEN_OFFICE_OPERATING_PROFILE,
  resolveOccupancyForStep,
} from "@/lib/sd-anlegg/mpc/config/resolve-occupancy";
import { resolveRegulatorForBuilding } from "@/lib/sd-anlegg/mpc/controller/regulator/resolve-regulator";
import { mpcStepKeyFromMs } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import type { MpcCalibrationBundle, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import { resolveInfraspawnBuildingForRead } from "@/lib/infraspawn/read-access";
import { loadEvalDatasetForMpc } from "@/services/mpc/load-eval-dataset";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";

export type RunControlTickResult =
  | {
      ok: true;
      skipped?: false;
      buildingSlug: string;
      tickId: string;
      tickAt: string;
      planDiffSummary: string;
      stepsInLoop: number;
      triggerReason: string;
    }
  | {
      ok: true;
      skipped: true;
      buildingSlug: string;
      triggerReason: string;
      detail: string;
    }
  | {
      ok: false;
      reason:
        | "building_unresolved"
        | "no_calibration"
        | "no_forward_plan"
        | "no_access";
      detail?: string;
    };

function resolveCurrentMeasStep(input: {
  liveDatasetSteps: readonly MpcTimestep[];
  liveObservation: Awaited<ReturnType<typeof loadLiveControlObservation>>;
}): MpcTimestep | null {
  const latestEvalStep =
    input.liveDatasetSteps.filter((s) => s.uMeas).at(-1) ??
    input.liveDatasetSteps.at(-1) ??
    null;
  if (!latestEvalStep) return null;
  return mergeLiveObservationIntoTimestep(latestEvalStep, input.liveObservation);
}

export async function runControlTick(input?: {
  buildingSlug?: string;
  triggerSource?: string;
  force?: boolean;
}): Promise<RunControlTickResult> {
  const buildingSlug = input?.buildingSlug ?? getDefaultBuildingSlug();
  const triggerSource = input?.triggerSource ?? "cron";

  const access = await resolveInfraspawnBuildingForRead(buildingSlug);
  if (!access.ok) {
    return { ok: false, reason: "no_access", detail: access.error };
  }

  const ctx = await resolveMpcBuildingSource({ buildingSlug });
  if (!ctx) {
    return { ok: false, reason: "building_unresolved" };
  }

  const pipelineRun = await loadLatestMpcPipelineRun(ctx.buildingId);
  const liveState = await prisma.sdAnleggLiveMpcState.findUnique({
    where: { buildingId: ctx.buildingId },
    select: { calibration: true, calibrationFingerprint: true },
  });

  const calibration: MpcCalibrationBundle | null =
    pipelineRun?.calibration ??
    (liveState?.calibration as MpcCalibrationBundle | null) ??
    null;

  if (!calibration) {
    return {
      ok: false,
      reason: "no_calibration",
      detail:
        "Kjør MPC-kalibrering først (thesis-mpc) — replay følger SD-sync automatisk",
    };
  }

  const since = new Date(Date.now() - 6 * 3_600_000);
  const buildingRow = await prisma.building.findUnique({
    where: { id: ctx.buildingId },
    select: {
      municipalityNumber: true,
      latitude: true,
      longitude: true,
    },
  });

  const [tickWorkspace, liveDataset, previousPlan, loopStepsTail, weatherForecast, liveObservation] =
    await Promise.all([
    loadControlTickWorkspace(ctx.buildingId, 1),
    loadEvalDatasetForMpc({
      buildingSlug,
      evalStart: since,
      evalEnd: new Date(),
    }),
    loadPersistedMpcForwardPlan(ctx.buildingId),
    loadControlLoopStepsTail(ctx.buildingId, 1),
    buildingRow
      ? loadControlWeatherForecast({
          buildingId: ctx.buildingId,
          municipalityNumber: buildingRow.municipalityNumber,
          latitude: buildingRow.latitude,
          longitude: buildingRow.longitude,
          hours: 6,
        })
      : Promise.resolve({ points: [], source: "unavailable" as const, stationLabel: null }),
    loadLiveControlObservation({
      buildingId: ctx.buildingId,
      buildingSlug,
      sourceId: ctx.sourceId,
    }),
  ]);

  const latestMeasStep = resolveCurrentMeasStep({
    liveDatasetSteps: liveDataset?.steps ?? [],
    liveObservation,
  });

  const comfortTemplate = preferenceTemplateForBuilding(buildingSlug);
  const comfortBand =
    latestMeasStep != null
      ? resolveComfortBandForStepWithOccupancy(
          latestMeasStep,
          comfortTemplate?.comfortSchedule ?? null,
          calibration.solver.comfortBandC,
          resolveOccupancyForStep(
            latestMeasStep,
            comfortTemplate?.operatingProfile ?? NAERBYEN_OFFICE_OPERATING_PROFILE,
            calibration.occupancy,
          ).q,
        )
      : calibration.solver.comfortBandC;

  const currentHourKey = latestMeasStep
    ? controlHourKeyFromIso(latestMeasStep.t)
    : controlHourKeyFromIso(new Date().toISOString());
  const forecastOutdoor =
    weatherForecast.points.find((p) => controlHourKeyFromIso(p.hour) === currentHourKey)
      ?.outdoorTempC ?? null;

  const recentMarginalKrPerKwh = (liveDataset?.steps ?? [])
    .slice(-96)
    .map((s) => s.effectiveMarginalKrPerKwh ?? s.spotKrPerKwh)
    .filter((v): v is number => v != null && Number.isFinite(v));

  const trigger = assessControlTickTrigger({
    triggerSource,
    lastControlTickAt: tickWorkspace.tickState?.lastControlTickAt ?? null,
    activeCommand: tickWorkspace.tickState?.activeCommand ?? null,
    uMeas: latestMeasStep?.uMeas ?? null,
    extractTempMeasC: latestMeasStep?.extractTempC ?? null,
    extractTempPredC:
      previousPlan?.planSteps[0]?.predictedExtractC ??
      loopStepsTail.at(-1)?.extractTempPredC ??
      null,
    comfortBand,
    outdoorTempMeasC: latestMeasStep?.outdoorTempC ?? null,
    outdoorTempForecastC: forecastOutdoor,
    currentMarginalKrPerKwh:
      latestMeasStep?.effectiveMarginalKrPerKwh ??
      latestMeasStep?.spotKrPerKwh ??
      null,
    recentMarginalKrPerKwh,
  });

  if (!input?.force && !trigger.shouldRun) {
    console.info("[control-tick] skipped:", {
      buildingSlug,
      reason: trigger.reason,
      detail: trigger.detail,
    });
    return {
      ok: true,
      skipped: true,
      buildingSlug,
      triggerReason: trigger.reason,
      detail: trigger.detail,
    };
  }

  const calibrationFingerprint =
    pipelineRun?.id ?? liveState?.calibrationFingerprint ?? "live";

  const loopSteps = await loadControlLoopStepsTail(ctx.buildingId, 96);
  const replayForPlan = pickReplayStepsForForwardPlan({
    loopSteps,
    evalReplaySteps: pipelineRun?.replaySteps,
  });

  const forwardBundle = await buildMpcForwardPlanBundleForBuilding({
    buildingId: ctx.buildingId,
    calibration,
    replaySteps: replayForPlan,
    initialControlOverride: latestMeasStep?.uMeas ?? null,
  });

  const forwardPlan = forwardBundle?.plan ?? null;

  if (!forwardPlan?.planSteps[0]) {
    return {
      ok: false,
      reason: "no_forward_plan",
      detail: "Mangler vær/pris-prognose eller kalibrering",
    };
  }

  const planStep0 = forwardPlan.planSteps[0]!;
  const tickAt = new Date(forwardPlan.computedAt);
  const stepAt = mpcStepKeyFromMs(tickAt.getTime());

  const regulator = resolveRegulatorForBuilding();
  const activeCommand = regulator.apply(
    { uDirect: planStep0.uMpc },
    {
      tExtC: latestMeasStep?.extractTempC ?? planStep0.predictedExtractC,
      tSupMeasC: latestMeasStep?.supplyTempMeasC ?? null,
      uPrevious: loopSteps.at(-1)?.uMpc ?? planStep0.uBmsSim,
    },
  );

  const planDiff = buildForwardPlanDiff({
    previous: previousPlan,
    current: forwardPlan,
  });

  const forwardPlans =
    forwardBundle != null
      ? buildPolicyForwardPlans({
          mpcPlan: forwardPlan,
          calibration,
          timesteps: forwardBundle.timesteps,
        })
      : { "mpc-v1": forwardPlan };

  const demandStep0 = forwardPlans["demand-scoped"]?.planSteps[0];
  const uDemand = demandStep0?.uMpc ?? planStep0.uBmsSim;

  const liveStep = buildLiveMultiPolicyStep({
    stepAt,
    uMeas:
      latestMeasStep?.uMeas ??
      loopSteps.at(-1)?.uBmsMeas ??
      pipelineRun?.replaySteps.at(-1)?.uBmsMeas ??
      null,
    uBmsSim: planStep0.uBmsSim,
    uMpc: activeCommand,
    uDemand,
    extractTempMeasC: latestMeasStep?.extractTempC ?? null,
    extractTempPredC: planStep0.predictedExtractC,
    supplySetpointOperatorC: latestMeasStep?.supplySetpointOperatorC ?? null,
    supplySetpointCalcC: latestMeasStep?.supplySetpointCalcC ?? null,
    supplyTempMeasC: latestMeasStep?.supplyTempMeasC ?? null,
    marginalKrPerKwh:
      latestMeasStep?.effectiveMarginalKrPerKwh ??
      planStep0.effectiveMarginalKrPerKwh,
    heatKrPerKwh: latestMeasStep?.heatKrPerKwh ?? null,
    outdoorTempC: latestMeasStep?.outdoorTempC ?? planStep0.outdoorTempC,
    outdoorTempFrostC: latestMeasStep?.outdoorTempFrostC ?? null,
    outdoorTempBmsC: latestMeasStep?.outdoorTempBmsC ?? null,
    buildingElectricityKwh: latestMeasStep?.buildingElectricityKwh ?? 0.5,
    buildingDistrictHeatingKwh: latestMeasStep?.buildingDistrictHeatingKwh ?? 0.2,
    power: calibration.power,
    coolingValveCommandPct: latestMeasStep?.coolingValveCommandPct ?? null,
    coolingValveFeedbackPct: latestMeasStep?.coolingValveFeedbackPct ?? null,
  });

  const { tickId } = await persistControlTickResult({
    buildingId: ctx.buildingId,
    tickAt,
    triggerSource,
    calibrationFingerprint,
    forwardPlan,
    forwardPlans,
    planDiff,
    activeCommand,
    uReference: planStep0.uBmsSim,
    liveStep,
    stateSnapshot: {
      extractTempC: latestMeasStep?.extractTempC ?? null,
      outdoorTempC: latestMeasStep?.outdoorTempC ?? null,
      observedAt: liveObservation.observedAt ?? latestMeasStep?.t ?? null,
      liveObservationSource: liveObservation.source,
      triggerReason: trigger.reason,
    },
  });

  try {
    revalidatePath(`/sd-anlegg/${buildingSlug}/styring`);
    revalidateTag(`mpc-coverage:${buildingSlug}`, { expire: 0 });
  } catch (error) {
    console.warn("[control-tick] revalidate skipped (ikke Next.js request context):", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const stepsInLoop = loopSteps.length + 1;
  console.info("[control-tick] ok:", {
    buildingSlug,
    tickAt: tickAt.toISOString(),
    summary: planDiff.summary,
    triggerReason: trigger.reason,
    stepsInLoop,
  });

  return {
    ok: true,
    buildingSlug,
    tickId,
    tickAt: tickAt.toISOString(),
    planDiffSummary: planDiff.summary,
    stepsInLoop,
    triggerReason: trigger.reason,
  };
}
