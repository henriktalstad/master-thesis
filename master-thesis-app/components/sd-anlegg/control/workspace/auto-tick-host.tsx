"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { runControlTickAction } from "@/actions/mpc-thesis";
import {
  STYRING_AUTO_TICK_CHECK_MS,
  STYRING_AUTO_TICK_COOLDOWN_MS,
} from "@/lib/sd-anlegg/control/control-constants";
import { isStyringLiveControlStale } from "@/lib/sd-anlegg/control/styring-live-stale";
import { invalidateStyringWorkspacePollQueries } from "@/queries/styring";
import { useIsClientMounted } from "@/hooks/use-is-client-mounted";

function sessionKey(buildingSlug: string): string {
  return `sd-anlegg-auto-tick:${buildingSlug}`;
}

function readLastAutoTick(buildingSlug: string): number {
  if (typeof sessionStorage === "undefined") return 0;
  const raw = sessionStorage.getItem(sessionKey(buildingSlug));
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function markAutoTick(buildingSlug: string): void {
  sessionStorage.setItem(sessionKey(buildingSlug), String(Date.now()));
}

type Props = {
  buildingSlug: string;
  lastControlTickAt: string | null;
  forwardPlanComputedAt?: string | null;
  hasMpcRun: boolean;
  activeTab?: "na" | "analyse" | "oppsett";
  simulationRunning?: boolean;
  examinerMode?: boolean;
};

function SdAnleggControlAutoTickHostInner({
  buildingSlug,
  lastControlTickAt,
  forwardPlanComputedAt = null,
  hasMpcRun,
  activeTab = "na",
  simulationRunning = false,
  examinerMode = false,
}: Props) {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);

  const maybeRunTick = useCallback(async () => {
    if (examinerMode || !hasMpcRun || simulationRunning || inFlightRef.current) return;
    if (activeTab !== "na") return;

    const nowMs = Date.now();
    if (!isStyringLiveControlStale({ lastControlTickAt, forwardPlanComputedAt, nowMs })) {
      return;
    }
    if (nowMs - readLastAutoTick(buildingSlug) < STYRING_AUTO_TICK_COOLDOWN_MS) {
      return;
    }

    inFlightRef.current = true;
    markAutoTick(buildingSlug);

    try {
      const result = await runControlTickAction({
        buildingSlug,
        force: true,
        skipPageRevalidate: true,
      });
      if (result.ok && !result.skipped) {
        await invalidateStyringWorkspacePollQueries(queryClient, buildingSlug);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [
    activeTab,
    buildingSlug,
    forwardPlanComputedAt,
    hasMpcRun,
    lastControlTickAt,
    queryClient,
    examinerMode,
    simulationRunning,
  ]);

  useEffect(() => {
    void maybeRunTick();
  }, [maybeRunTick]);

  useEffect(() => {
    if (activeTab !== "na" || !hasMpcRun || simulationRunning) return;

    const timer = window.setInterval(() => {
      void maybeRunTick();
    }, STYRING_AUTO_TICK_CHECK_MS);

    return () => window.clearInterval(timer);
  }, [activeTab, examinerMode, hasMpcRun, maybeRunTick, simulationRunning]);

  return null;
}

export function SdAnleggControlAutoTickHost(props: Props) {
  const mounted = useIsClientMounted();
  if (!mounted) return null;
  return <SdAnleggControlAutoTickHostInner {...props} />;
}
