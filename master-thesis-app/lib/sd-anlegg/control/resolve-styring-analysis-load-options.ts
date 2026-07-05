import type { StyringAnalysisViewId } from "./control-styring-analysis-views";
import type { LoadMpcEvalArtifactsOptions } from "./load-mpc-eval-artifacts";

/** View-scoped lasting — unngå full replay + alle artifacts på hver Effekt-navigasjon. */
export function resolveStyringAnalysisLoadOptions(
  view: StyringAnalysisViewId,
): Pick<
  LoadMpcEvalArtifactsOptions,
  "includeFullReplaySteps" | "skipAnalysisArtifacts" | "tailStepCount"
> {
  switch (view) {
    case "signaler":
      return { includeFullReplaySteps: true, skipAnalysisArtifacts: true };
    case "energi":
      return { includeFullReplaySteps: true, skipAnalysisArtifacts: false };
    case "pris":
      return {
        includeFullReplaySteps: false,
        skipAnalysisArtifacts: false,
        tailStepCount: 96,
      };
    case "oversikt":
    default:
      return {
        includeFullReplaySteps: false,
        skipAnalysisArtifacts: false,
        tailStepCount: 96,
      };
  }
}
