export type MpcWorkspaceSimulationStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed";

export type MpcWorkspaceContentRevisionInput = {
  canonicalRunId: string | null;
  latestRunId: string | null;
  lastControlTickAt: string | null;
  replayWatermarkAt: string | null;
  simulationStatus: MpcWorkspaceSimulationStatus;
  simulationTerminalAt: string | null;
  simulationStepIndex: number | null;
  displayRunId: string | null;
};

export function buildMpcWorkspaceContentRevision(
  input: MpcWorkspaceContentRevisionInput,
): string {
  return [
    input.canonicalRunId ?? "none",
    input.latestRunId ?? "none",
    input.displayRunId ?? "none",
    input.lastControlTickAt ?? "none",
    input.replayWatermarkAt ?? "none",
    input.simulationStatus,
    input.simulationTerminalAt ?? "none",
    input.simulationStepIndex ?? "none",
  ].join(":");
}
