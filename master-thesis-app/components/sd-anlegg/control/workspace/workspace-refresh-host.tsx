"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  assessWorkspaceRevisionRefreshKind,
  snapshotWorkspaceRevision,
  type WorkspaceRevisionSnapshot,
} from "@/lib/sd-anlegg/control/assess-workspace-revision-change";
import { MPC_WORKSPACE_REFRESH_COOLDOWN_MS } from "@/lib/sd-anlegg/control/control-constants";
import type { StyringTabId } from "@/lib/sd-anlegg/control/control-styring-tabs";
import { shouldRunStyringPageRefresh } from "@/lib/sd-anlegg/control/resolve-styring-page-refresh";
import type { MpcSimulationProgress } from "@/lib/sd-anlegg/control/mpc-simulation-progress";
import {
  invalidateStyringWorkspacePollQueries,
  invalidateStyringAnalysisQueries,
} from "@/queries/styring";
import { useStyringWorkspacePoll } from "@/components/sd-anlegg/control/workspace/styring-poll-provider";

type Props = {
  buildingSlug: string;
  activeTab: StyringTabId;
  initialContentRevision: string;
  initialSimulationProgress: MpcSimulationProgress | null;
  examinerMode?: boolean;
};

export function SdAnleggControlWorkspaceRefreshHost({
  buildingSlug,
  activeTab,
  initialContentRevision,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data } = useStyringWorkspacePoll();
  const lastContentRevisionRef = useRef(initialContentRevision);
  const lastSnapshotRef = useRef<WorkspaceRevisionSnapshot | null>(null);
  const lastRefreshAtRef = useRef(0);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    lastContentRevisionRef.current = initialContentRevision;
  }, [initialContentRevision]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current != null) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!data?.contentRevision) return;

    const nextRevision = data.contentRevision;
    if (nextRevision === lastContentRevisionRef.current) return;

    const refreshKind = assessWorkspaceRevisionRefreshKind(
      lastSnapshotRef.current,
      data,
    );
    lastSnapshotRef.current = snapshotWorkspaceRevision(data);

    const commitRevision = () => {
      lastContentRevisionRef.current = nextRevision;
    };

    if (refreshKind === "none") {
      commitRevision();
      return;
    }

    if (refreshKind === "live") {
      commitRevision();
      void invalidateStyringWorkspacePollQueries(queryClient, buildingSlug);
      return;
    }

    const runFullRefresh = () => {
      if (refreshTimerRef.current != null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      commitRevision();
      lastRefreshAtRef.current = Date.now();
      void invalidateStyringWorkspacePollQueries(queryClient, buildingSlug);
      void invalidateStyringAnalysisQueries(queryClient, buildingSlug);
      if (shouldRunStyringPageRefresh({ refreshKind: "full", activeTab })) {
        router.refresh();
      }
    };

    const now = Date.now();
    const cooledDown =
      now - lastRefreshAtRef.current >= MPC_WORKSPACE_REFRESH_COOLDOWN_MS;

    if (cooledDown) {
      runFullRefresh();
      return;
    }

    if (refreshTimerRef.current != null) return;

    const waitMs =
      MPC_WORKSPACE_REFRESH_COOLDOWN_MS - (now - lastRefreshAtRef.current);
    refreshTimerRef.current = window.setTimeout(
      runFullRefresh,
      Math.max(waitMs, 2_000),
    );
  }, [activeTab, buildingSlug, data, queryClient, router]);

  return null;
}
