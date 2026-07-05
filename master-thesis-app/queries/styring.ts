import type { QueryClient } from "@tanstack/react-query";
import type { StyringAnalysisViewId } from "@/lib/sd-anlegg/control/control-styring-analysis-views";

export const STYRING_WORKSPACE_POLL_QUERY_KEY = "styring-workspace-poll";
export const STYRING_ANALYSIS_PAYLOAD_QUERY_KEY = "styring-analysis-payload";

export function styringWorkspacePollQueryKey(buildingSlug: string): readonly [
  typeof STYRING_WORKSPACE_POLL_QUERY_KEY,
  string,
] {
  return [STYRING_WORKSPACE_POLL_QUERY_KEY, buildingSlug];
}

export function styringAnalysisPayloadQueryKey(
  buildingSlug: string,
  view: StyringAnalysisViewId,
): readonly [typeof STYRING_ANALYSIS_PAYLOAD_QUERY_KEY, string, StyringAnalysisViewId] {
  return [STYRING_ANALYSIS_PAYLOAD_QUERY_KEY, buildingSlug, view];
}

export function invalidateStyringWorkspacePollQueries(
  queryClient: QueryClient,
  buildingSlug: string,
): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: styringWorkspacePollQueryKey(buildingSlug),
  });
}

export function invalidateStyringAnalysisQueries(
  queryClient: QueryClient,
  buildingSlug: string,
): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: [STYRING_ANALYSIS_PAYLOAD_QUERY_KEY, buildingSlug],
  });
}

export function invalidateStyringWorkspaceQueries(
  queryClient: QueryClient,
  buildingSlug: string,
): Promise<void> {
  return Promise.all([
    invalidateStyringWorkspacePollQueries(queryClient, buildingSlug),
    invalidateStyringAnalysisQueries(queryClient, buildingSlug),
  ]).then(() => undefined);
}
