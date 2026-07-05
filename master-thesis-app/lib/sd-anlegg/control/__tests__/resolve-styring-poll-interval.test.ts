import { describe, expect, test } from "bun:test";
import { resolveStyringWorkspacePollInterval } from "@/lib/sd-anlegg/control/resolve-styring-poll-interval";
import {
  MPC_WORKSPACE_REVISION_POLL_MS,
  MPC_WORKSPACE_REVISION_POLL_RUNNING_MS,
  STYRING_LIVE_POLL_FINE_MS,
  STYRING_LIVE_POLL_MS,
} from "@/lib/sd-anlegg/control/control-constants";

describe("resolveStyringWorkspacePollInterval", () => {
  test("live-fane bruker fin poll ved grain 1/5", () => {
    expect(
      resolveStyringWorkspacePollInterval({
        activeTab: "na",
        grain: "1",
        simulationRunning: false,
      }),
    ).toBe(STYRING_LIVE_POLL_FINE_MS);
  });

  test("live-fane bruker 15s poll ved grain 15", () => {
    expect(
      resolveStyringWorkspacePollInterval({
        activeTab: "na",
        grain: "15",
        simulationRunning: false,
      }),
    ).toBe(STYRING_LIVE_POLL_MS);
  });

  test("analyse bruker revisjonspoll", () => {
    expect(
      resolveStyringWorkspacePollInterval({
        activeTab: "analyse",
        grain: "15",
        simulationRunning: false,
      }),
    ).toBe(MPC_WORKSPACE_REVISION_POLL_MS);
  });

  test("raskere poll når simulering kjører", () => {
    expect(
      resolveStyringWorkspacePollInterval({
        activeTab: "analyse",
        grain: "15",
        simulationRunning: true,
      }),
    ).toBe(MPC_WORKSPACE_REVISION_POLL_RUNNING_MS);
  });
});
