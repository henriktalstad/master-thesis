import type { StyringTabId } from "@/lib/sd-anlegg/control/control-styring-tabs";
import type { StyringSignalGrain } from "@/lib/sd-anlegg/control/resolve-control-lookback";
import {
  MPC_WORKSPACE_REVISION_POLL_MS,
  MPC_WORKSPACE_REVISION_POLL_RUNNING_MS,
  STYRING_LIVE_POLL_FINE_MS,
  STYRING_LIVE_POLL_MS,
} from "@/lib/sd-anlegg/control/control-constants";

export function resolveStyringWorkspacePollInterval(input: {
  activeTab: StyringTabId;
  grain: StyringSignalGrain;
  simulationRunning: boolean;
}): number {
  if (input.activeTab === "na") {
    return input.grain === "1" || input.grain === "5"
      ? STYRING_LIVE_POLL_FINE_MS
      : STYRING_LIVE_POLL_MS;
  }
  return input.simulationRunning
    ? MPC_WORKSPACE_REVISION_POLL_RUNNING_MS
    : MPC_WORKSPACE_REVISION_POLL_MS;
}
