import type { StyringTabId } from "./control-styring-tabs";
import type { WorkspaceRevisionRefreshKind } from "./assess-workspace-revision-change";

/** Full RSC-refresh er tung — reserver den til faner som trenger server-props umiddelbart. */
export function shouldRunStyringPageRefresh(input: {
  refreshKind: WorkspaceRevisionRefreshKind;
  activeTab: StyringTabId;
}): boolean {
  if (input.refreshKind !== "full") return false;
  return input.activeTab === "analyse" || input.activeTab === "oppsett";
}
