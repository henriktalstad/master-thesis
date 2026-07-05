#!/usr/bin/env bun
/**
 * Kjør full MPC-pipeline: kalibrering, validering og historisk replay.
 * Foretrekk `bun run thesis-mpc` for full ensure + export.
 */

import "dotenv/config";

import { runAndPersistMpcSimulation } from "@/services/mpc/run-simulation";
import { writeMpcSimulationArtifacts } from "@/lib/thesis-export/write-mpc-simulation-artifacts";

async function main() {
  console.log("[mpc-simulation] starter pipeline…");
  const run = await runAndPersistMpcSimulation();

  if (!run.ok) {
    console.error("[mpc-simulation] feilet:", run.reason, run.detail ?? "");
    if ("coverage" in run && run.coverage) {
      console.error("[mpc-simulation] dekning:", run.coverage);
    }
    console.error(
      "[mpc-simulation] tips: bun run thesis-mpc for full data-ensure + export",
    );
    process.exit(1);
  }

  await writeMpcSimulationArtifacts(run.result);

  console.log("\n[mpc-simulation] emulator MAE (holdout):");
  console.log(JSON.stringify(run.result.emulatorValidation.mae, null, 2));
  console.log("\n[mpc-simulation] replay summary:");
  console.log(JSON.stringify(run.result.replay.summary, null, 2));

  if (run.mpcRunId) {
    console.log(`\n[mpc-simulation] persistert mpc-v1 i DB (run ${run.mpcRunId})`);
  } else {
    console.warn("[mpc-simulation] DB-persist hoppet over — sjekk BUILDING_SLUG");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
