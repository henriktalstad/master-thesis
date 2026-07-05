import type { ControlWorkspaceData } from "@/lib/sd-anlegg/control/control-types";
import type { StyringTabId } from "@/lib/sd-anlegg/control/control-styring-tabs";
import { STYRING_TABS } from "@/lib/sd-anlegg/control/control-styring-tabs";

export type StyringTabAvailability = {
  id: StyringTabId;
  label: string;
  available: boolean;
  reason: string | null;
};

type Input = Pick<
  ControlWorkspaceData,
  | "simulationError"
  | "mpcForwardPlan"
  | "mpcPipelineRun"
  | "mpcEvalCoverage"
  | "controlTickState"
>;

export function resolveStyringTabAvailability(
  input: Input,
): StyringTabAvailability[] {
  const hasMpcRun = input.mpcPipelineRun?.snapshot != null;
  const canSimulate = input.mpcEvalCoverage?.canSimulate ?? false;

  return STYRING_TABS.map((tab) => {
    switch (tab.id) {
      case "na":
        return {
          id: tab.id,
          label: tab.label,
          available: true,
          reason: null,
        };
      case "analyse":
        return {
          id: tab.id,
          label: tab.label,
          available: hasMpcRun,
          reason: hasMpcRun
            ? null
            : canSimulate
              ? (input.simulationError ??
                "Data er klare — replay kjøres automatisk ved sync")
              : (input.mpcEvalCoverage?.blockReason ??
                input.simulationError ??
                "Trenger mer SD-data i eval-vinduet"),
        };
      case "oppsett":
        return {
          id: tab.id,
          label: tab.label,
          available: true,
          reason: null,
        };
    }
  });
}

export function findFirstAvailableStyringTab(
  tabs: readonly StyringTabAvailability[],
): StyringTabAvailability | undefined {
  return tabs.find((tab) => tab.available);
}

export function isStyringTabAvailable(
  tabs: readonly StyringTabAvailability[],
  tabId: StyringTabId,
): boolean {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return false;
  if (tabId === "na" || tabId === "oppsett") return true;
  return tab.available;
}

export function resolveStyringTabDescription(input: {
  tabId: StyringTabId;
  availability: StyringTabAvailability | undefined;
}): string | null {
  const tab = STYRING_TABS.find((t) => t.id === input.tabId);
  if (!tab) return null;

  if (input.availability && !input.availability.available && input.tabId !== "na") {
    return input.availability.reason;
  }

  return tab.description;
}
