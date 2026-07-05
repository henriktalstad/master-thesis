#!/usr/bin/env bun
/**
 * Historisk import av Statkraft fjernvarme inn i district_heating_measurements.
 *
 * Usage:
 *   bun run import-statkraft-measurements
 *   bun run import-statkraft-measurements -- --from=2026-06-01 --to=2026-06-30
 */

import "dotenv/config";
import { addDaysToYmd, osloYmdFromDate, toUTCForOslo } from "@/lib/utils";
import { getThesisEvalWindow } from "@/lib/config/thesis-eval";
import { resolveBhccSyncWindow } from "@/lib/energy/bhcc-sync-window";
import { syncStatkraftDistrictHeating } from "@/services/integrations/sync-statkraft-district-heating";

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }
  return undefined;
}

function resolveWindow(): { start: Date; endExclusive: Date } {
  const fromArg = parseArg("from");
  const toArg = parseArg("to");

  if (fromArg && toArg) {
    const endYmd = addDaysToYmd(toArg, 1);
    return {
      start: new Date(toUTCForOslo(fromArg, 0)),
      endExclusive: new Date(toUTCForOslo(endYmd, 0)),
    };
  }

  const evalWin = getThesisEvalWindow();
  if (evalWin.start && evalWin.end) {
    const endYmd = osloYmdFromDate(evalWin.end);
    return {
      start: evalWin.start,
      endExclusive: new Date(toUTCForOslo(addDaysToYmd(endYmd, 1), 0)),
    };
  }

  const bhcc = resolveBhccSyncWindow();
  const startYmd = addDaysToYmd(bhcc.throughOsloYmd, -89);
  return {
    start: new Date(toUTCForOslo(startYmd, 0)),
    endExclusive: bhcc.endExclusive,
  };
}

async function main() {
  const window = resolveWindow();
  console.log(
    `[import-statkraft] Vindu ${window.start.toISOString()} → ${window.endExclusive.toISOString()} (exclusive)`,
  );

  const result = await syncStatkraftDistrictHeating({
    windowStart: window.start,
    windowEndExclusive: window.endExclusive,
    pauseBetweenIntervalsMs: 1000,
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.skipped) {
    console.warn(`[import-statkraft] Hoppet over: ${result.message}`);
    process.exit(result.success ? 0 : 1);
  }

  if (!result.success) {
    console.error(`[import-statkraft] Feilet: ${result.message}`);
    process.exit(1);
  }

  console.log(
    `[import-statkraft] OK — ${result.measurementsUpserted} målinger for ${result.meteringPointCount} målepunkt(er)`,
  );
}

main().catch((error) => {
  console.error("[import-statkraft] FEIL:", error);
  process.exit(1);
});
