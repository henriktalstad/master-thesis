import type { MpcWorkspaceRevision } from "./load-mpc-workspace-revision";

export type WorkspaceRevisionSnapshot = {
  canonicalRunId: string | null;
  latestRunId: string | null;
  lastControlTickAt: string | null;
  replayWatermarkAt: string | null;
  simulationStatus: string;
};

export type WorkspaceRevisionRefreshKind = "none" | "live" | "full";

export function snapshotWorkspaceRevision(
  revision: MpcWorkspaceRevision,
): WorkspaceRevisionSnapshot {
  return {
    canonicalRunId: revision.canonicalRunId,
    latestRunId: revision.latestRunId,
    lastControlTickAt: revision.lastControlTickAt,
    replayWatermarkAt: revision.replayWatermarkAt,
    simulationStatus: revision.simulationProgress?.status ?? "idle",
  };
}

/**
 * Velg hvordan klienten skal oppdatere etter revisjonsendring.
 * - full: ny pipeline-run / simulering ferdig → invalider poll/analyse; RSC-refresh kun på Effekt/Oppsett
 * - live: tick eller inkrementell replay → React Query-invalidering
 * - none: simuleringsfremdrift (banner oppdateres via poll)
 */
export function assessWorkspaceRevisionRefreshKind(
  previous: WorkspaceRevisionSnapshot | null,
  next: MpcWorkspaceRevision,
): WorkspaceRevisionRefreshKind {
  const nextSnapshot = snapshotWorkspaceRevision(next);

  if (!previous) {
    return nextSnapshot.simulationStatus === "running" ? "none" : "full";
  }

  if (
    nextSnapshot.canonicalRunId !== previous.canonicalRunId ||
    nextSnapshot.latestRunId !== previous.latestRunId
  ) {
    return "full";
  }

  const prevStatus = previous.simulationStatus;
  const nextStatus = nextSnapshot.simulationStatus;

  if (
    (nextStatus === "completed" || nextStatus === "failed") &&
    prevStatus === "running"
  ) {
    return "full";
  }

  if (nextStatus === "running" && prevStatus === "running") {
    return "none";
  }

  if (
    nextSnapshot.lastControlTickAt !== previous.lastControlTickAt ||
    nextSnapshot.replayWatermarkAt !== previous.replayWatermarkAt
  ) {
    return "live";
  }

  if (nextStatus !== prevStatus && nextStatus !== "idle") {
    return nextStatus === "running" ? "none" : "full";
  }

  return "none";
}
