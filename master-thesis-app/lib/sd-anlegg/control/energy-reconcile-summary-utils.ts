import type { MpcEnergyReconcileSummary } from "./build-mpc-energy-reconcile";

/** Scalar DB-stub uten time-alignment — må recompute fra replay + BHCC. */
export function isIncompleteReconcileSummary(
  summary: MpcEnergyReconcileSummary | null | undefined,
): boolean {
  if (!summary) return true;
  if (
    summary.hoursAligned === 0 &&
    summary.measured.hours === 0 &&
    summary.proxy.observed.costKr === 0 &&
    summary.proxy.observed.elKwh === 0
  ) {
    return true;
  }
  return (
    summary.heatingDemand.activeSteps === 0 &&
    summary.districtDeltaT.length === 0 &&
    summary.shares.heatGroundTruth === "none"
  );
}
