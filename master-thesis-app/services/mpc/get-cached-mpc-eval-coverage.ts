import "server-only";

import { unstable_cache } from "next/cache";
import {
  analyzeMpcEvalCoverage,
  type MpcEvalCoverageReport,
} from "./analyze-eval-coverage";
export async function getCachedMpcEvalCoverageForPage(
  buildingSlug: string,
): Promise<MpcEvalCoverageReport | null> {
  return unstable_cache(
    async () => analyzeMpcEvalCoverage({ buildingSlug }),
    ["mpc-eval-coverage-page", buildingSlug],
    { revalidate: 60, tags: [`mpc-coverage:${buildingSlug}`] },
  )();
}
