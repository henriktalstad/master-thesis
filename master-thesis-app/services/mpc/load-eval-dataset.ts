import { prisma } from "@/lib/db";
import {
  getMpcGapFillMaxSteps,
  getMpcMinOptimizablePct,
  getThesisEvalWindow,
  isMpcTrimEvalFallbackSuffixEnabled,
} from "@/lib/config/thesis-eval";
import { resolveSampleObjectIdAliasesForMpc as resolveSampleObjectIdAliases } from "./resolve-sample-object-ids";
import { getBuildingWeatherBinding } from "@/lib/weather/ensure-pinned-station";
import {
  getElectricityZoneForBuilding,
  toMinimalBuildingForZone,
} from "@/lib/utils";
import { CONTROL_SIGNAL_CATALOG_360102 } from "@/lib/sd-anlegg/control/control-signal-catalog";
import {
  applyEvalSampleToAccumulator,
  type EvalTimestepPlantAccumulator,
} from "@/lib/sd-anlegg/control/control-signal-registry-360102";
import { controlHourKeyFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import {
  deriveMarginalAddonKrPerKwh,
  hourUtcFromPriceRow,
} from "@/lib/sd-anlegg/control/control-effective-price-utils";
import {
  estimateCoolingActive,
  estimateHeatingActive,
} from "@/lib/sd-anlegg/control/control-sd-calibration";
import { resolvePointForCatalogEntryInContext } from "@/lib/sd-anlegg/control/resolve-control-catalog";
import type { EvalDataset, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import {
  bucketSamplesByMpcStep,
  buildMpcTimeGrid,
  parseMpcStepKey,
} from "@/lib/sd-anlegg/mpc/shared/time-grid";
import { fillMpcStepGaps } from "@/lib/sd-anlegg/mpc/dataset/fill-step-gaps";
import { fillCoordinatedMpcChannelGaps } from "@/lib/sd-anlegg/mpc/dataset/fill-coordinated-channels";
import { resolveMpcBuildingSource } from "./resolve-mpc-context";
import { buildObservedControlVector } from "./build-u-meas";
import { readCoolingValveSampleValues } from "./cooling-valve-samples";
import { normalizeEvalValveSamplePct } from "./normalize-eval-valve-sample";
import { resolveCoolingValveFeedbackObjectId } from "@/lib/sd-anlegg/control/resolve-cooling-valve-pct";
import { loadMpcResolveContext } from "./load-mpc-resolve-context";
import {
  resolveMpcEvalBounds,
  trimEvalEndToMinOptimizablePct,
} from "./resolve-mpc-eval-bounds";
import { loadMpcAlarmActiveSteps } from "./load-mpc-alarm-steps";
import { countMpcStepCoverageMetrics } from "./mpc-step-coverage";
import { resolveOutdoorTempForStep } from "@/lib/sd-anlegg/control/resolve-outdoor-temp";
import {
  MPC_EVAL_DATASET_CANONICALS,
  MPC_U_MEAS_CANONICAL_SET,
} from "./mpc-canonicals";
import { loadMpcDatasetProvenance } from "./load-dataset-provenance";
import { allocateHourlyEnergyToSteps } from "@/lib/sd-anlegg/envelope-model/power/energy-quantity";

async function loadHourlyWeatherSince(
  buildingId: string,
  since: Date,
  until: Date,
): Promise<Array<{ hour: string; outdoorTempC: number | null }>> {
  const binding = await getBuildingWeatherBinding(buildingId);
  if (!binding?.stationId) return [];

  const series = await prisma.weatherSeries.findFirst({
    where: {
      stationId: binding.stationId,
      elementId: { in: ["air_temperature", "mean(air_temperature PT1H)"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!series) return [];

  const observations = await prisma.weatherObservation.findMany({
    where: {
      seriesId: series.id,
      referenceTime: { gte: since, lte: until },
    },
    select: { referenceTime: true, value: true },
    orderBy: { referenceTime: "asc" },
  });

  const byHour = new Map<string, number>();
  for (const row of observations) {
    if (row.value == null) continue;
    const key = controlHourKeyFromIso(row.referenceTime.toISOString());
    byHour.set(key, Math.round(Number(row.value) * 10) / 10);
  }

  return [...byHour.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([hourKey, outdoorTempC]) => ({
      hour: new Date(`${hourKey}:00:00.000Z`).toISOString(),
      outdoorTempC,
    }));
}

async function loadEffectivePrices(input: {
  buildingId: string;
  areaCode: string | null;
  since: Date;
  until: Date;
}) {
  const [spotRows, bhccRows] = await Promise.all([
    input.areaCode
      ? prisma.hourlyEnergyPrices.findMany({
          where: {
            areaCode: input.areaCode,
            date: { gte: input.since, lte: input.until },
          },
          orderBy: [{ date: "asc" }, { hour: "asc" }],
          select: { date: true, hour: true, price: true },
        })
      : Promise.resolve([]),
    prisma.buildingHourlyCostCache.findMany({
      where: {
        buildingId: input.buildingId,
        hour: { gte: input.since, lte: input.until },
      },
      orderBy: { hour: "asc" },
      select: {
        hour: true,
        electricityVolumeKwh: true,
        electricitySpotCost: true,
        electricityGridEnergyCost: true,
        electricityConsumptionTaxCost: true,
        electricityPriceNokPerKwh: true,
      },
    }),
  ]);

  const marginalAddon = deriveMarginalAddonKrPerKwh(bhccRows);
  const bhccByKey = new Map(
    bhccRows.map((row) => [
      controlHourKeyFromIso(row.hour.toISOString()),
      row,
    ]),
  );

  const prices: Array<{
    hour: string;
    spotKrPerKwh: number | null;
    effectiveMarginalKrPerKwh: number | null;
  }> = [];

  for (const spot of spotRows) {
    if (spot.date == null || spot.hour == null) continue;
    const hour = hourUtcFromPriceRow(spot.date, spot.hour);
    const key = controlHourKeyFromIso(hour);
    const bhcc = bhccByKey.get(key);
    const spotKr = spot.price != null ? Number(spot.price) : null;
    const addon =
      bhcc && (bhcc.electricityVolumeKwh ?? 0) > 0
        ? (bhcc.electricityGridEnergyCost +
            bhcc.electricityConsumptionTaxCost) /
          (bhcc.electricityVolumeKwh ?? 1)
        : marginalAddon;
    prices.push({
      hour,
      spotKrPerKwh: spotKr,
      effectiveMarginalKrPerKwh:
        spotKr != null ? Math.round((spotKr + addon) * 1000) / 1000 : null,
    });
  }

  return prices;
}

async function loadSamplesForRange(input: {
  sourceId: string;
  objectIds: string[];
  start: Date;
  end: Date;
  uMeasObjectIds?: string[];
}): Promise<Map<string, Map<string, number>>> {
  const uniqueObjectIds = [...new Set(input.objectIds)];
  const aliasMap = await resolveSampleObjectIdAliases(
    input.sourceId,
    uniqueObjectIds,
  );
  const canonicalIds = [
    ...new Set(uniqueObjectIds.map((id) => aliasMap.get(id) ?? id)),
  ];

  const rows = await prisma.infraspawnBacnetSample.findMany({
    where: {
      sourceId: input.sourceId,
      objectId: { in: canonicalIds },
      resolution: "15m",
      sampledAt: { gte: input.start, lte: input.end },
    },
    select: { objectId: true, sampledAt: true, valueNum: true },
    orderBy: { sampledAt: "asc" },
  });

  const byCanonical = new Map<string, { t: string; value: number }[]>();
  for (const objectId of canonicalIds) {
    byCanonical.set(objectId, []);
  }
  for (const row of rows) {
    if (row.valueNum == null) continue;
    byCanonical.get(row.objectId)?.push({
      t: row.sampledAt.toISOString(),
      value: row.valueNum,
    });
  }

  const byRequested = new Map<string, Map<string, number>>();
  const gapFillMax = getMpcGapFillMaxSteps();
  const gridKeys = buildMpcTimeGrid(input.start, input.end);

  for (const requested of uniqueObjectIds) {
    const canonical = aliasMap.get(requested) ?? requested;
    const bucketed = bucketSamplesByMpcStep(byCanonical.get(canonical) ?? []);
    const { filled } =
      gapFillMax > 0
        ? fillMpcStepGaps(gridKeys, bucketed, {
            maxForwardSteps: gapFillMax,
            maxBackwardSteps: gapFillMax,
          })
        : { filled: bucketed };
    byRequested.set(requested, filled);
  }

  const uMeasIds = input.uMeasObjectIds?.filter((id) => byRequested.has(id)) ?? [];
  if (gapFillMax > 0 && uMeasIds.length > 1) {
    const channels = new Map<string, ReadonlyMap<string, number>>();
    for (const id of uMeasIds) {
      channels.set(id, byRequested.get(id)!);
    }
    const coordinated = fillCoordinatedMpcChannelGaps(
      gridKeys,
      channels,
      uMeasIds,
      { maxForwardSteps: gapFillMax, maxBackwardSteps: gapFillMax },
    );
    for (const [id, filled] of coordinated) {
      byRequested.set(id, filled);
    }
  }

  return byRequested;
}

export async function loadEvalDatasetForMpc(input?: {
  buildingSlug?: string;
  evalStart?: Date;
  evalEnd?: Date;
}): Promise<EvalDataset | null> {
  const resolved = await resolveMpcBuildingSource({
    buildingSlug: input?.buildingSlug,
  });
  if (!resolved) return null;

  const bounds = await resolveMpcEvalBounds({
    buildingSlug: input?.buildingSlug ?? resolved.buildingSlug,
    evalStart: input?.evalStart,
    evalEnd: input?.evalEnd,
  });
  const evalStart =
    bounds?.evalStart ??
    input?.evalStart ??
    getThesisEvalWindow().start ??
    new Date(Date.now() - 14 * 86400000);
  let evalEnd =
    bounds?.evalEnd ??
    input?.evalEnd ??
    getThesisEvalWindow().end ??
    new Date();

  const building = await prisma.building.findUnique({
    where: { id: resolved.buildingId },
    select: {
      id: true,
      municipalityNumber: true,
      region: true,
      postCode: true,
      postalPlace: true,
      latitude: true,
      longitude: true,
    },
  });
  if (!building) return null;

  const mpcCtx = await loadMpcResolveContext({
    buildingId: resolved.buildingId,
    buildingSlug: input?.buildingSlug ?? resolved.buildingSlug,
    sourceId: resolved.sourceId,
  });
  const points = mpcCtx.points;
  const canonicalResolved = MPC_EVAL_DATASET_CANONICALS.flatMap((canonicalId) => {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === canonicalId,
    );
    if (!entry) return [];
    const point = resolvePointForCatalogEntryInContext({
      points,
      entry,
      context: mpcCtx,
    });
    if (!point) return [];
    return [{ canonicalId, objectId: point.objectId, point }];
  });

  const pointMetaByObjectId = new Map(
    canonicalResolved.map(({ objectId, point }) => [objectId, point]),
  );

  const { zone } = getElectricityZoneForBuilding(
    toMinimalBuildingForZone(building),
  );

  const uMeasObjectIds = canonicalResolved
    .filter((row) => MPC_U_MEAS_CANONICAL_SET.has(row.canonicalId))
    .map((row) => row.objectId);

  const coolingCommandObjectId =
    canonicalResolved.find((r) => r.canonicalId === "cooling.valve.command")
      ?.objectId ?? null;
  const coolingCommandPoint =
    canonicalResolved.find((r) => r.canonicalId === "cooling.valve.command")
      ?.point ?? null;
  const coolingFeedbackObjectId = resolveCoolingValveFeedbackObjectId(points);
  const coolingFeedbackPoint = coolingFeedbackObjectId
    ? (points.find((p) => p.objectId === coolingFeedbackObjectId) ?? null)
    : null;

  const sampleObjectIds = [
    ...canonicalResolved.map((r) => r.objectId),
    ...(coolingFeedbackObjectId ? [coolingFeedbackObjectId] : []),
  ];

  const [sampleMaps, weather, prices, energyRows, alarmActiveSteps, provenance] =
    await Promise.all([
      loadSamplesForRange({
        sourceId: resolved.sourceId,
        objectIds: sampleObjectIds,
        uMeasObjectIds,
        start: evalStart,
        end: evalEnd,
      }),
      loadHourlyWeatherSince(building.id, evalStart, evalEnd),
      loadEffectivePrices({
        buildingId: building.id,
        areaCode: zone === "ukjent" ? null : zone,
        since: evalStart,
        until: evalEnd,
      }),
      prisma.buildingHourlyCostCache.findMany({
        where: {
          buildingId: building.id,
          hour: { gte: evalStart, lte: evalEnd },
        },
        orderBy: { hour: "asc" },
        select: {
          hour: true,
          electricityVolumeKwh: true,
          coolingVolumeKwh: true,
          districtHeatingVolumeKwh: true,
          districtHeatingTotalCost: true,
          districtHeatingEffectCost: true,
        },
      }),
      loadMpcAlarmActiveSteps({
        buildingId: building.id,
        evalStart,
        evalEnd,
        grid: buildMpcTimeGrid(evalStart, evalEnd),
      }),
      loadMpcDatasetProvenance({
        buildingId: building.id,
        sourceId: resolved.sourceId,
        evalStart,
        evalEnd,
        sampleObjectIds,
        areaCode: zone === "ukjent" ? null : zone,
      }),
    ]);

  const weatherByHour = new Map(
    weather.map((w) => [controlHourKeyFromIso(w.hour), w.outdoorTempC]),
  );
  const priceByHour = new Map(
    prices.map((p) => [
      controlHourKeyFromIso(p.hour),
      { spot: p.spotKrPerKwh, marginal: p.effectiveMarginalKrPerKwh },
    ]),
  );
  const energyByHour = new Map(
    energyRows.map((row) => [
      controlHourKeyFromIso(row.hour.toISOString()),
      {
        electricityKwh: row.electricityVolumeKwh ?? 0,
        coolingKwh: row.coolingVolumeKwh ?? 0,
        districtHeatingKwh: row.districtHeatingVolumeKwh ?? 0,
        heatKrPerKwh:
          row.districtHeatingVolumeKwh && row.districtHeatingVolumeKwh > 0
            ? ((row.districtHeatingTotalCost ?? 0) +
                (row.districtHeatingEffectCost ?? 0)) /
              row.districtHeatingVolumeKwh
            : null,
      },
    ]),
  );

  const grid = buildMpcTimeGrid(evalStart, evalEnd);
  let steps: MpcTimestep[] = [];

  for (const t of grid) {
    const parsed = parseMpcStepKey(t);
    const hourKey = controlHourKeyFromIso(t);
    const energy = energyByHour.get(hourKey);
    const price = priceByHour.get(hourKey);
    const frostOutdoorTempC = weatherByHour.get(hourKey) ?? null;

    const acc: EvalTimestepPlantAccumulator = { sampleValues: {} };

    for (const { canonicalId, objectId } of canonicalResolved) {
      const raw = sampleMaps.get(objectId)?.get(t);
      if (raw == null) continue;
      const point = pointMetaByObjectId.get(objectId);
      const value =
        point != null
          ? normalizeEvalValveSamplePct(canonicalId, raw, point)
          : raw;
      applyEvalSampleToAccumulator(canonicalId, value, acc);
    }

    const {
      sampleValues,
      extractTempC,
      supplyTempMeasC,
      intakeTempMeasC,
      extractSetpointC,
      heatRecoveryAfterTempC,
      outdoorTempBmsSample,
      supplyFanFlowM3h,
      exhaustFanFlowM3h,
      heatingCoilTempC,
      heatRecoveryEfficiencyPct,
      frostRiskRaw,
      fireAlarmRaw,
      lowEfficiencyRaw,
      districtTr002ValvePct,
      districtTr003ValvePct,
      districtTr002SupplyTempC,
      districtTr003SupplyTempC,
      districtTr002ReturnTempC,
      districtTr003ReturnTempC,
      districtTr002SupplySetpointC,
      districtTr003SupplySetpointC,
      districtMeterTr002EnergyKwh,
      districtMeterTr002PowerKw,
      districtMeterTr002SupplyTempC,
      districtMeterTr002ReturnTempC,
      districtMeterTr003EnergyKwh,
      districtMeterTr003PowerKw,
      districtMeterTr003SupplyTempC,
      districtMeterTr003ReturnTempC,
      districtTr002PumpObserved,
      districtTr003PumpObserved,
      ventilationSfp,
      systemPlantMode,
      heatRecoveryRotationGuardRaw,
      pumpHeatingMalfunctionRaw,
      pumpCoolingMalfunctionRaw,
    } = acc;

    const outdoorResolved = resolveOutdoorTempForStep({
      frostC: frostOutdoorTempC,
      bmsC: outdoorTempBmsSample ?? null,
    });
    const outdoorTempC = outdoorResolved.outdoorTempC;

    Object.assign(
      sampleValues,
      readCoolingValveSampleValues({
        t,
        sampleMaps,
        commandObjectId: coolingCommandObjectId,
        feedbackObjectId: coolingFeedbackObjectId,
        commandPoint: coolingCommandPoint,
        feedbackPoint: coolingFeedbackPoint,
        outdoorTempC,
      }),
    );

    const uMeas = buildObservedControlVector(sampleValues);
    if (uMeas == null) continue;

    const profileForMode = {
      hour: t,
      supplySetpointC: uMeas.supplySetpointC,
      supplyFanPct: uMeas.supplyFanPct,
      exhaustFanPct: uMeas.exhaustFanPct,
      heatingValvePct: uMeas.heatingValvePct,
      coolingValvePct: uMeas.coolingValvePct,
      districtTr002ValvePct: uMeas.districtTr002ValvePct,
      districtTr003ValvePct: uMeas.districtTr003ValvePct,
    };

    const fireActive = fireAlarmRaw != null && fireAlarmRaw > 0;

    steps.push({
      t,
      tMs: new Date(t).getTime(),
      dowUtc: parsed.dowUtc,
      hourUtc: parsed.hourUtc,
      quarterUtc: parsed.quarterUtc,
      hourLocal: parsed.hourLocal,
      uMeas,
      supplySetpointOperatorC: sampleValues.supplySetpointC ?? null,
      supplySetpointCalcC: sampleValues.supplySetpointCalcC ?? null,
      extractTempC: extractTempC ?? null,
      supplyTempMeasC: supplyTempMeasC ?? null,
      intakeTempMeasC: intakeTempMeasC ?? null,
      extractSetpointC: extractSetpointC ?? null,
      heatRecoveryAfterTempC: heatRecoveryAfterTempC ?? null,
      supplyFanFlowM3h: supplyFanFlowM3h ?? null,
      exhaustFanFlowM3h: exhaustFanFlowM3h ?? null,
      heatingCoilTempC: heatingCoilTempC ?? null,
      heatRecoveryEfficiencyPct: heatRecoveryEfficiencyPct ?? null,
      frostRiskActive: frostRiskRaw != null ? frostRiskRaw > 0 : undefined,
      fireAlarmActive: fireActive || undefined,
      lowEfficiencyActive:
        lowEfficiencyRaw != null ? lowEfficiencyRaw > 0 : undefined,
      outdoorTempC,
      outdoorTempFrostC: outdoorResolved.outdoorTempFrostC,
      outdoorTempBmsC: outdoorResolved.outdoorTempBmsC,
      spotKrPerKwh: price?.spot ?? null,
      effectiveMarginalKrPerKwh: price?.marginal ?? null,
      heatKrPerKwh: energy?.heatKrPerKwh ?? null,
      buildingElectricityKwh: allocateHourlyEnergyToSteps(energy?.electricityKwh ?? 0),
      buildingCoolingKwh: allocateHourlyEnergyToSteps(energy?.coolingKwh ?? 0),
      buildingDistrictHeatingKwh: allocateHourlyEnergyToSteps(
        energy?.districtHeatingKwh ?? 0,
      ),
      heatingActive: estimateHeatingActive(profileForMode),
      coolingActive: estimateCoolingActive(profileForMode, outdoorTempC),
      alarmActive: alarmActiveSteps.has(t) || fireActive,
      coolingValveCommandPct: sampleValues.coolingValveCommandPct ?? null,
      coolingValveFeedbackPct: sampleValues.coolingValveFeedbackPct ?? null,
      districtTr002ValvePct: districtTr002ValvePct ?? null,
      districtTr003ValvePct: districtTr003ValvePct ?? null,
      districtTr002SupplyTempC: districtTr002SupplyTempC ?? null,
      districtTr003SupplyTempC: districtTr003SupplyTempC ?? null,
      districtTr002ReturnTempC: districtTr002ReturnTempC ?? null,
      districtTr003ReturnTempC: districtTr003ReturnTempC ?? null,
      districtTr002SupplySetpointC: districtTr002SupplySetpointC ?? null,
      districtTr003SupplySetpointC: districtTr003SupplySetpointC ?? null,
      districtMeterTr002EnergyKwh: districtMeterTr002EnergyKwh ?? null,
      districtMeterTr002PowerKw: districtMeterTr002PowerKw ?? null,
      districtMeterTr002SupplyTempC: districtMeterTr002SupplyTempC ?? null,
      districtMeterTr002ReturnTempC: districtMeterTr002ReturnTempC ?? null,
      districtMeterTr003EnergyKwh: districtMeterTr003EnergyKwh ?? null,
      districtMeterTr003PowerKw: districtMeterTr003PowerKw ?? null,
      districtMeterTr003SupplyTempC: districtMeterTr003SupplyTempC ?? null,
      districtMeterTr003ReturnTempC: districtMeterTr003ReturnTempC ?? null,
      districtTr002PumpObserved,
      districtTr003PumpObserved,
      ventilationSfp: ventilationSfp ?? null,
      systemPlantMode: systemPlantMode ?? null,
      heatRecoveryRotationGuardRaw: heatRecoveryRotationGuardRaw ?? null,
      pumpHeatingMalfunctionActive:
        pumpHeatingMalfunctionRaw != null ? pumpHeatingMalfunctionRaw > 0 : undefined,
      pumpCoolingMalfunctionActive:
        pumpCoolingMalfunctionRaw != null ? pumpCoolingMalfunctionRaw > 0 : undefined,
    });
  }

  if (isMpcTrimEvalFallbackSuffixEnabled()) {
    const optimizableTrim = trimEvalEndToMinOptimizablePct({
      evalEnd,
      steps,
      minOptimizablePct: getMpcMinOptimizablePct(),
    });
    if (optimizableTrim.trimmed) {
      steps = optimizableTrim.steps;
      evalEnd = optimizableTrim.evalEnd;
      console.log("[mpc-dataset] eval-slutt klippet for fallback-hale:", {
        optimizablePct: optimizableTrim.optimizablePct,
        stepCount: steps.length,
        evalEnd: evalEnd.toISOString(),
      });
    }
  }

  const coverageMetrics = countMpcStepCoverageMetrics(steps);

  return {
    buildingId: resolved.buildingId,
    sourceId: resolved.sourceId,
    evalStart: evalStart.toISOString(),
    evalEnd: evalEnd.toISOString(),
    steps,
    coverage: {
      stepCount: steps.length,
      stepsWithUMeas: coverageMetrics.stepsWithUMeas,
      stepsOptimizable: coverageMetrics.optimizableSteps,
      optimizablePct: coverageMetrics.optimizablePct,
      stepsWithExtractTemp: steps.filter((s) => s.extractTempC != null).length,
      stepsWithOutdoorTemp: steps.filter((s) => s.outdoorTempC != null).length,
      stepsWithOutdoorTempBms: steps.filter((s) => s.outdoorTempBmsC != null)
        .length,
      stepsWithPrice: steps.filter((s) => s.effectiveMarginalKrPerKwh != null)
        .length,
    },
    provenance,
  };
}

export type { EvalDataset };
