import "server-only";

import { prisma } from "@/lib/db";
import {
  compareCsvEvalGroundTruth,
  loadEvalGroundTruthManifest,
} from "@/lib/eval/load-eval-ground-truth";
import type { EnergyGroundTruthBundle } from "@/lib/eval/eval-ground-truth-types";
import {
  summarizeBhccMeasuredEnergy,
  type BhccMeasuredRow,
} from "@/lib/eval/summarize-bhcc-measured-energy";

/**
 * Målt energi og pris uten manuelle data/eval-filer.
 * Primær kilde: buildingHourlyCostCache (Kost/BHCC) + spot (ENTSO-E / Nord Pool).
 * Valgfri overlay: data/eval/*.csv når faktura/elhub finnes.
 */
export async function resolveEnergyGroundTruth(input: {
  buildingId: string;
  evalStart: Date;
  evalEnd: Date;
}): Promise<EnergyGroundTruthBundle> {
  const evalStart = input.evalStart.toISOString();
  const evalEnd = input.evalEnd.toISOString();

  const rows = await prisma.buildingHourlyCostCache.findMany({
    where: {
      buildingId: input.buildingId,
      hour: { gte: input.evalStart, lt: input.evalEnd },
    },
    orderBy: { hour: "asc" },
    select: {
      hour: true,
      electricityVolumeKwh: true,
      electricityTotalCost: true,
      electricitySpotCost: true,
      electricityGridEnergyCost: true,
      electricityConsumptionTaxCost: true,
      electricityPriceNokPerKwh: true,
      districtHeatingVolumeKwh: true,
      districtHeatingTotalCost: true,
      spotPriceSource: true,
    },
  });

  const bhcc = summarizeBhccMeasuredEnergy({
    rows: rows as BhccMeasuredRow[],
    evalStart: input.evalStart,
    evalEnd: input.evalEnd,
  });

  const csvOverlay = compareCsvEvalGroundTruth({
    evalStart,
    evalEnd,
    bhccElectricityKwh: bhcc.measured.electricityKwh,
    bhccDistrictHeatingKwh: bhcc.measured.districtHeatingKwh,
  });

  const notes: string[] = [
    "Primær ground truth: Kost/BHCC (buildingHourlyCostCache) — målt byggvolum + kost per time.",
    `Spotpris: ${bhcc.prices.spotHoursEntsoe} ENTSO-E · ${bhcc.prices.spotHoursNordPool} Nord Pool · nettleie-addon ${bhcc.prices.marginalAddonKrPerKwh} kr/kWh.`,
    `Time-dekning i eval-vindu: ${bhcc.hourlyCoveragePct} % (${bhcc.measured.hourCount}/${bhcc.expectedHours} timer).`,
  ];

  if (csvOverlay) {
    notes.push(
      `Ekstern overlay fra data/eval (${csvOverlay.manifest.files.join(", ")}) — brukes til faktura-avstemming, ikke som eneste kilde.`,
    );
  } else if (!loadEvalGroundTruthManifest()) {
    notes.push(
      "Ingen data/eval CSV — estimater og reconcile kjører på BHCC + ENTSO-E uten manuell import.",
    );
  }

  return {
    primarySource: "bhcc_kost",
    evalStart,
    evalEnd,
    measured: bhcc.measured,
    prices: bhcc.prices,
    hourlyCoveragePct: bhcc.hourlyCoveragePct,
    csvOverlay,
    notes,
  };
}
