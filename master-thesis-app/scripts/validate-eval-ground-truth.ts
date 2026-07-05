#!/usr/bin/env bun
/**
 * Validerer målt energi i eval-vinduet.
 * Primær sjekk: BHCC/Kost i DB (ingen manuelle CSV-filer påkrevd).
 * Valgfritt: data/eval/*.csv når manifest finnes.
 *
 * Usage:
 *   bun run validate-eval-ground-truth
 */

import "dotenv/config";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { resolveEnergyGroundTruth } from "@/lib/eval/resolve-energy-ground-truth";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";
import { resolveEffectiveEvalWindowForMpc } from "@/services/mpc/resolve-effective-eval-window";

async function main() {
  const ctx = await resolveMpcBuildingSource({
    buildingSlug: resolveBuildingSlug(),
  });
  if (!ctx) {
    console.error(`[validate-eval] Fant ikke bygg «${resolveBuildingSlug()}» i DB`);
    process.exit(1);
  }

  const buildingSlug = resolveBuildingSlug();
  const evalWindow = await resolveEffectiveEvalWindowForMpc({ buildingSlug });
  const evalStart = evalWindow.evalStart;
  const evalEnd = evalWindow.evalEnd;

  if (evalWindow.clipped) {
    console.info(
      "[validate-eval] eval-vindu klippet:",
      evalWindow.actions.join("; "),
    );
  }

  const bundle = await resolveEnergyGroundTruth({
    buildingId: ctx.buildingId,
    evalStart,
    evalEnd,
  });

  console.info(
    "[validate-eval] BHCC/Kost:",
    bundle.evalStart,
    "→",
    bundle.evalEnd,
  );
  console.info(
    `[validate-eval] el ${bundle.measured.electricityKwh} kWh · FV ${bundle.measured.districtHeatingKwh} kWh · ${bundle.measured.hourCount}/${Math.round((new Date(bundle.evalEnd).getTime() - new Date(bundle.evalStart).getTime()) / 3_600_000)} timer (${bundle.hourlyCoveragePct} %)`,
  );
  console.info(
    `[validate-eval] spot: ${bundle.prices.spotHoursEntsoe} ENTSO-E · ${bundle.prices.spotHoursNordPool} Nord Pool`,
  );

  const minHourlyCoverage = 90;
  if (bundle.hourlyCoveragePct < minHourlyCoverage) {
    console.error(
      `[validate-eval] BHCC time-dekning under ${minHourlyCoverage} % — synk Kost eller utvid eval-vindu`,
    );
    process.exit(1);
  }

  if (bundle.csvOverlay) {
    console.info(
      "[validate-eval] CSV-overlay:",
      bundle.csvOverlay.manifest.files.join(", "),
    );
    const minCsvCoverage = 90;
    const elCov =
      bundle.csvOverlay.validation.electricity15min?.coveragePct ?? 100;
    const dhCov =
      bundle.csvOverlay.validation.districtHeating15min?.coveragePct ?? 100;
    if (elCov < minCsvCoverage || dhCov < minCsvCoverage) {
      console.error(`[validate-eval] CSV 15-min dekning under ${minCsvCoverage} %`);
      process.exit(1);
    }
  } else {
    console.info(
      "[validate-eval] ingen data/eval CSV — estimater kjører på BHCC + ENTSO-E alene",
    );
  }

  for (const note of bundle.notes) {
    console.info(`[validate-eval] ${note}`);
  }
  console.info("[validate-eval] OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
