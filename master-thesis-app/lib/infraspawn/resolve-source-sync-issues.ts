export type InfraspawnSourceSyncIssue = {
  sourceId: string;
  label: string;
  syncStatus: string | null;
  lastError: string | null;
  lastSuccessfulSyncAt: string | null;
};

export function resolveInfraspawnSourceSyncIssues(
  sources: readonly {
    id: string;
    label: string;
    syncStatus: string | null;
    lastError?: string | null;
    lastSuccessfulSyncAt: string | null;
  }[],
): InfraspawnSourceSyncIssue[] {
  return sources
    .filter(
      (source) =>
        Boolean(source.lastError?.trim()) ||
        source.syncStatus === "ERROR" ||
        source.syncStatus === "FAILED",
    )
    .map((source) => ({
      sourceId: source.id,
      label: source.label,
      syncStatus: source.syncStatus,
      lastError: source.lastError?.trim() ?? null,
      lastSuccessfulSyncAt: source.lastSuccessfulSyncAt,
    }));
}
