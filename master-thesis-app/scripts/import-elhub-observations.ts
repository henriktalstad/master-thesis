#!/usr/bin/env bun
/**
 * Historisk import av Elhub/Enelyze times-AMS inn i observations.
 *
 * Usage:
 *   bun run import-elhub-observations
 *   bun run import-elhub-observations -- --from=2026-06-01 --to=2026-06-30
 */

import "dotenv/config";
import { addDaysToYmd, osloYmdFromDate, toUTCForOslo } from "@/lib/utils";
import { getThesisEvalWindow } from "@/lib/config/thesis-eval";
import { resolveBhccSyncWindow } from "@/lib/energy/bhcc-sync-window";
import { syncElhubElectricity } from "@/services/integrations/sync-elhub-electricity";

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
    `[import-elhub] Vindu ${window.start.toISOString()} → ${window.endExclusive.toISOString()} (exclusive)`,
  );

  const result = await syncElhubElectricity({
    windowStart: window.start,
    windowEndExclusive: window.endExclusive,
    pauseBetweenIntervalsMs: 1000,
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.skipped) {
    console.warn(`[import-elhub] Hoppet over: ${result.message}`);
    process.exit(result.success ? 0 : 1);
  }

  if (!result.success) {
    console.error(`[import-elhub] Feilet: ${result.message}`);
    process.exit(1);
  }

  console.log(
    `[import-elhub] OK — ${result.observationsUpserted} observasjoner for ${result.meteringPointCount} målepunkt(er)`,
  );
}

main().catch((error) => {
  console.error("[import-elhub] FEIL:", error);
  process.exit(1);
});
