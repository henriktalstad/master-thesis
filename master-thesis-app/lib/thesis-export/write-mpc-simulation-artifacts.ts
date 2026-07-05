import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildMpcSignalComparison } from "@/lib/sd-anlegg/control/build-mpc-signal-comparison";
import { buildMpcPipelineSnapshot } from "@/lib/sd-anlegg/control/persist-mpc-pipeline-run";
import type { MpcPipelineResult } from "@/lib/sd-anlegg/mpc/shared/types";

export async function writeMpcSimulationArtifacts(
  result: MpcPipelineResult,
): Promise<string> {
  const outDir = resolve(process.cwd(), "data/simulation");
  await mkdir(outDir, { recursive: true });

  const snapshot = buildMpcPipelineSnapshot(result);
  const comparison = buildMpcSignalComparison(result.replay.steps);

  const manifest = {
    ...snapshot,
    hourlyComparison: comparison,
  };

  await writeFile(
    resolve(outDir, "mpc_pipeline_result.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    resolve(outDir, "mpc_calibration.json"),
    `${JSON.stringify(result.calibration, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    resolve(outDir, "mpc_replay_summary.json"),
    `${JSON.stringify(result.replay.summary, null, 2)}\n`,
    "utf8",
  );

  return outDir;
}
