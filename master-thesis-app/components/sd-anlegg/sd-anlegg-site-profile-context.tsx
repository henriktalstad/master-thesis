"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import type { ResolvedSdAnleggSiteProfile } from "@/lib/sd-anlegg/site-profile-schema";

type SdAnleggSiteProfileContextValue = {
  profile: ResolvedSdAnleggSiteProfile;
  canEditProfile: boolean;
};

const SdAnleggSiteProfileContext =
  createContext<SdAnleggSiteProfileContextValue | null>(null);

export function SdAnleggSiteProfileProvider({
  profile,
  canEditProfile = false,
  children,
}: {
  profile: ResolvedSdAnleggSiteProfile;
  canEditProfile?: boolean;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ profile, canEditProfile }),
    [profile, canEditProfile],
  );

  return (
    <SdAnleggSiteProfileContext.Provider value={value}>
      {children}
    </SdAnleggSiteProfileContext.Provider>
  );
}

export function useSdAnleggSiteProfile(): ResolvedSdAnleggSiteProfile | null {
  return use(SdAnleggSiteProfileContext)?.profile ?? null;
}

export function useSdAnleggCanEditProfile(): boolean {
  return use(SdAnleggSiteProfileContext)?.canEditProfile ?? false;
}
