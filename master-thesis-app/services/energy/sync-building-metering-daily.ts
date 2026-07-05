import "server-only";

import { syncElhubElectricity } from "@/services/integrations/sync-elhub-electricity";
import { syncStatkraftDistrictHeating } from "@/services/integrations/sync-statkraft-district-heating";
import { syncBuildingHourlyCosts } from "./sync-building-hourly-costs";

export type SyncBuildingMeteringDailyResult = {
  success: boolean;
  message: string;
  elhub: Awaited<ReturnType<typeof syncElhubElectricity>>;
  statkraft: Awaited<ReturnType<typeof syncStatkraftDistrictHeating>>;
  bhcc: Awaited<ReturnType<typeof syncBuildingHourlyCosts>>;
};

/**
 * Daglig byggenergi-kjede (cron `sync-building-metering-daily`, ca. kl. 10 Oslo):
 * Enelyze/Elhub → Statkraft FV → BHCC. Data forventes komplett t.o.m. i går (T+1).
 */
export async function syncBuildingMeteringDaily(input?: {
  buildingSlug?: string;
}): Promise<SyncBuildingMeteringDailyResult> {
  const elhub = await syncElhubElectricity(input);
  const statkraft = await syncStatkraftDistrictHeating(input);
  const bhcc = await syncBuildingHourlyCosts({
    mode: "refresh_recent",
    buildingSlug: input?.buildingSlug,
  });

  const failures: string[] = [];
  if (!elhub.success && !elhub.skipped) {
    failures.push(`Elhub: ${elhub.message}`);
  }
  if (!statkraft.success && !statkraft.skipped) {
    failures.push(`Statkraft: ${statkraft.message}`);
  }
  if (!bhcc.success) {
    failures.push(`BHCC: ${bhcc.message}`);
  }

  const success = failures.length === 0;
  const message = success
    ? `Daglig kjede OK — Elhub ${elhub.observationsUpserted} obs, Statkraft ${statkraft.measurementsUpserted} FV, BHCC ${bhcc.hoursUpserted} t`
    : failures.join("; ");

  return { success, message, elhub, statkraft, bhcc };
}
