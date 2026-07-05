"use client";

import { createContext, use, type ReactNode } from "react";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

const SdAnleggLivePointsContext = createContext<
  readonly InfraspawnPointListItem[] | null
>(null);

export function SdAnleggLivePointsProvider({
  initialPoints,
  children,
}: {
  initialPoints: readonly InfraspawnPointListItem[];
  children: ReactNode;
}) {
  return (
    <SdAnleggLivePointsContext.Provider value={initialPoints}>
      {children}
    </SdAnleggLivePointsContext.Provider>
  );
}

export function useSdAnleggServerInitialPoints():
  | readonly InfraspawnPointListItem[]
  | undefined {
  const points = use(SdAnleggLivePointsContext);
  return points && points.length > 0 ? points : undefined;
}
