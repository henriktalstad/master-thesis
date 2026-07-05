import "server-only";

import { prisma } from "@/lib/db";
import {
  getElectricityZoneForBuilding,
  toMinimalBuildingForZone,
} from "@/lib/utils";
import { buildMpcForwardPlan, buildForwardTimesteps } from "@/lib/sd-anlegg/mpc/pipeline/build-forward-plan";
import type {
  MpcCalibrationBundle,
  MpcReplayStep,
} from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcForwardPlan } from "./control-types-live";
import { buildControlForwardPrices } from "./control-effective-price-utils";
import { ensureControlForecastInputs } from "./ensure-control-forecast-inputs";
import { loadControlEffectivePrices } from "./load-control-effective-prices";
import { loadControlWeatherForecast } from "./load-control-weather-forecast";
import { loadMedianHeatKrPerKwh } from "./load-median-heat-kr-per-kwh";
import { resolveMpcInitialControl } from "./resolve-mpc-initial-control";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import { loadBuildingComfortTargets } from "@/services/mpc/load-building-comfort-band";
import { resolveGenericMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/resolve-preferences";

export type MpcForwardPlanBundle = {
  plan: MpcForwardPlan;
  timesteps: MpcTimestep[];
};

export async function buildMpcForwardPlanBundleForBuilding(input: {
  buildingId: string;
  calibration: MpcCalibrationBundle;
  replaySteps?: readonly MpcReplayStep[];
  initialControlOverride?: MpcControlVector | null;
}): Promise<MpcForwardPlanBundle | null> {
  const building = await prisma.building.findUnique({
    where: { id: input.buildingId },
    select: {
      id: true,
      slug: true,
      municipalityNumber: true,
      latitude: true,
      longitude: true,
    },
  });
  if (!building) return null;

  const { zone } = getElectricityZoneForBuilding(
    toMinimalBuildingForZone(building),
  );

  const areaCode = zone === "ukjent" ? null : zone;

  const weatherForecastBundle = await loadControlWeatherForecast({
    buildingId: building.id,
    municipalityNumber: building.municipalityNumber,
    latitude: building.latitude,
    longitude: building.longitude,
  });

  if (weatherForecastBundle.points.length === 0) return null;

  const forecastEnsure = await ensureControlForecastInputs({
    buildingId: building.id,
    areaCode,
    forwardHourKeys: weatherForecastBundle.points.map((point) => point.hour),
    syncTariffs: true,
  });

  if (forecastEnsure.coverageAfter.missingDayAheadForwardHours > 0) {
    console.warn("[forward-plan] mangler day-ahead pris etter sync:", {
      buildingId: building.id,
      missingDayAhead: forecastEnsure.coverageAfter.missingDayAheadForwardHours,
      missingBeyondHorizon:
        forecastEnsure.coverageAfter.missingForwardPriceHours -
        forecastEnsure.coverageAfter.missingDayAheadForwardHours,
      priced: forecastEnsure.coverageAfter.pricedForwardHours,
      synced: forecastEnsure.energyPricesSynced,
    });
  }

  const priceBundle = await loadControlEffectivePrices({
    buildingId: building.id,
    areaCode,
    since: new Date(Date.now() - 7 * 86400000),
    forwardUntil: new Date(Date.now() + 2 * 86400000),
  });

  if (priceBundle.forwardMarginalSource === "bhcc_median") {
    console.warn("[forward-plan] nettleie fra BHCC-median — gridTariff tom eller mangler", {
      buildingId: building.id,
      gridSynced: forecastEnsure.gridTariffsSynced,
    });
  }

  const heatKrPerKwh = await loadMedianHeatKrPerKwh(building.id);

  const hourlyPrices = priceBundle.prices ?? [];
  const priceForecast = buildControlForwardPrices(
    hourlyPrices,
    weatherForecastBundle.points,
  );

  const initialControl = resolveMpcInitialControl({
    override: input.initialControlOverride,
    replaySteps: input.replaySteps,
  });
  const lastReplay = input.replaySteps?.at(-1);
  const initialExtractTempC =
    lastReplay?.extractTempMeasC ?? lastReplay?.extractTempPredC ?? null;

  const timesteps = buildForwardTimesteps({
    calibration: input.calibration,
    weatherForecast: weatherForecastBundle.points,
    priceForecast,
    initialControl,
    heatKrPerKwh,
  });

  const comfortTargets = await loadBuildingComfortTargets(building.id);
  const buildingPreferences = building.slug
    ? resolveGenericMpcBuildingPreferences({
        buildingSlug: building.slug,
        replaySteps: input.replaySteps,
        comfortTargets,
      })
    : undefined;

  const plan = buildMpcForwardPlan({
    calibration: input.calibration,
    weatherForecast: weatherForecastBundle.points,
    priceForecast,
    initialControl,
    initialExtractTempC,
    weatherSource: weatherForecastBundle.source,
    buildingPreferences,
    heatKrPerKwh,
  });

  if (!plan) return null;
  return { plan, timesteps };
}

export async function buildMpcForwardPlanForBuilding(input: {
  buildingId: string;
  calibration: MpcCalibrationBundle;
  replaySteps?: readonly MpcReplayStep[];
}): Promise<MpcForwardPlan | null> {
  const bundle = await buildMpcForwardPlanBundleForBuilding(input);
  return bundle?.plan ?? null;
}
