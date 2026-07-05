import { describe, expect, test } from "bun:test";
import { buildMpcWorkspaceContentRevision } from "@/lib/sd-anlegg/control/mpc-workspace-revision-utils";

describe("buildMpcWorkspaceContentRevision", () => {
  const base = {
    canonicalRunId: "run-a",
    latestRunId: "run-a",
    displayRunId: "run-a",
    lastControlTickAt: "2026-07-02T10:00:00.000Z",
    replayWatermarkAt: "2026-07-02T10:00:00.000Z",
    simulationStatus: "running" as const,
    simulationTerminalAt: null,
    simulationStepIndex: null,
  };

  test("endres når simulerings-steg øker", () => {
    const a = buildMpcWorkspaceContentRevision({
      ...base,
      simulationStepIndex: 96,
    });
    const b = buildMpcWorkspaceContentRevision({
      ...base,
      simulationStepIndex: 192,
    });
    expect(a).not.toBe(b);
  });

  test("endres ved completed", () => {
    const running = buildMpcWorkspaceContentRevision(base);
    const done = buildMpcWorkspaceContentRevision({
      ...base,
      simulationStatus: "completed",
      simulationTerminalAt: "2026-07-02T12:00:00.000Z",
    });
    expect(running).not.toBe(done);
  });

  test("endres ved ny control-tick", () => {
    const a = buildMpcWorkspaceContentRevision(base);
    const b = buildMpcWorkspaceContentRevision({
      ...base,
      lastControlTickAt: "2026-07-02T11:00:00.000Z",
    });
    expect(a).not.toBe(b);
  });
});
