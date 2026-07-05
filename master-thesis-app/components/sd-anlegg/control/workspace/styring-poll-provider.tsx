"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { getStyringWorkspacePollAction } from "@/actions/mpc-thesis";
import type { StyringTabId } from "@/lib/sd-anlegg/control/control-styring-tabs";
import type { StyringSignalGrain } from "@/lib/sd-anlegg/control/resolve-control-lookback";
import type { StyringLiveControlPoll } from "@/lib/sd-anlegg/control/load-styring-live-poll";
import type { StyringWorkspacePollData } from "@/lib/sd-anlegg/control/load-styring-workspace-poll";
import type { MpcSimulationProgress } from "@/lib/sd-anlegg/control/mpc-simulation-progress";
import { resolveStyringWorkspacePollInterval } from "@/lib/sd-anlegg/control/resolve-styring-poll-interval";
import { styringWorkspacePollQueryKey } from "@/queries/styring";

type StyringPollContextValue = {
  data: StyringWorkspacePollData | undefined;
  simulationProgress: MpcSimulationProgress | null;
  liveControl: StyringLiveControlPoll | null;
};

const StyringPollContext = createContext<StyringPollContextValue | null>(null);

export { resolveStyringWorkspacePollInterval } from "@/lib/sd-anlegg/control/resolve-styring-poll-interval";

export function useStyringWorkspacePoll(): StyringPollContextValue {
  const ctx = useContext(StyringPollContext);
  if (!ctx) {
    throw new Error("useStyringWorkspacePoll must be used within SdAnleggStyringPollProvider");
  }
  return ctx;
}

type ProviderProps = {
  buildingSlug: string;
  activeTab: StyringTabId;
  grain: StyringSignalGrain;
  enabled: boolean;
  initialSimulationProgress: MpcSimulationProgress | null;
  children: ReactNode;
};

export function SdAnleggStyringPollProvider({
  buildingSlug,
  activeTab,
  grain,
  enabled,
  initialSimulationProgress,
  children,
}: ProviderProps) {
  const { data } = useQuery({
    queryKey: styringWorkspacePollQueryKey(buildingSlug),
    queryFn: () => getStyringWorkspacePollAction(buildingSlug),
    enabled,
    refetchInterval: (query) =>
      resolveStyringWorkspacePollInterval({
        activeTab,
        grain,
        simulationRunning:
          query.state.data?.simulationProgress?.status === "running",
      }),
    refetchIntervalInBackground: activeTab === "na",
    staleTime: 5_000,
  });

  const value = useMemo<StyringPollContextValue>(
    () => ({
      data,
      simulationProgress: data?.simulationProgress ?? initialSimulationProgress,
      liveControl: data?.liveControl ?? null,
    }),
    [data, initialSimulationProgress],
  );

  return (
    <StyringPollContext.Provider value={value}>{children}</StyringPollContext.Provider>
  );
}
