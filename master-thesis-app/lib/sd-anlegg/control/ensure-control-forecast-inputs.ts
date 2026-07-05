import "server-only";

import { syncEnergyPrices } from "@/services/energy/sync-energy-prices";
import { syncBuildingGridTariffs } from "@/services/grid-tariffs/sync-building-grid-tariffs";
import {
  assessControlForecastCoverage,
  type ControlForecastCoverage,
} from "./assess-control-forecast-coverage";

export type EnsureControlForecastInputsResult = {
  coverageBefore: ControlForecastCoverage;
  coverageAfter: ControlForecastCoverage;
  energyPricesSynced: boolean;
  gridTariffsSynced: boolean;
  syncMessages: string[];
};

/** Avoid hammering ENTSO-E when day-ahead is not published yet (ack XML). */
const ENTSOE_EMPTY_SYNC_COOLDOWN_MS = 15 * 60_000;
let lastEntsoeEmptySyncAtMs = 0;

export function resetControlForecastSyncCooldownForTests(): void {
  lastEntsoeEmptySyncAtMs = 0;
}

export async function ensureControlForecastInputs(input: {
  buildingId: string;
  areaCode: string | null;
  forwardHourKeys: readonly string[];
  /** Sett false i tester for å unngå eksterne API-kall. */
  syncPrices?: boolean;
  syncTariffs?: boolean;
}): Promise<EnsureControlForecastInputsResult> {
  void input.buildingId;
  const syncPrices = input.syncPrices ?? true;
  const syncTariffs = input.syncTariffs ?? true;
  const syncMessages: string[] = [];

  const coverageBefore = await assessControlForecastCoverage({
    areaCode: input.areaCode,
    forwardHourKeys: input.forwardHourKeys,
  });

  let energyPricesSynced = false;
  let gridTariffsSynced = false;

  const entsoeCooldownActive =
    Date.now() - lastEntsoeEmptySyncAtMs < ENTSOE_EMPTY_SYNC_COOLDOWN_MS;

  if (
    syncPrices &&
    coverageBefore.needsEnergyPriceSync &&
    !entsoeCooldownActive
  ) {
    const priceResult = await syncEnergyPrices();
    energyPricesSynced = true;
    syncMessages.push(priceResult.message);
    if (priceResult.savedPricesCount === 0) {
      lastEntsoeEmptySyncAtMs = Date.now();
    }
  } else if (
    syncPrices &&
    coverageBefore.needsEnergyPriceSync &&
    entsoeCooldownActive
  ) {
    syncMessages.push(
      "Prissync utsatt (ENTSO-E uten day-ahead nylig — bruker eksisterende DB-priser)",
    );
  }

  if (syncTariffs && coverageBefore.needsEnergyPriceSync) {
    const tariffResult = await syncBuildingGridTariffs();
    gridTariffsSynced = tariffResult.success;
    syncMessages.push(tariffResult.message);
  }

  const coverageAfter = await assessControlForecastCoverage({
    areaCode: input.areaCode,
    forwardHourKeys: input.forwardHourKeys,
  });

  return {
    coverageBefore,
    coverageAfter,
    energyPricesSynced,
    gridTariffsSynced,
    syncMessages,
  };
}
