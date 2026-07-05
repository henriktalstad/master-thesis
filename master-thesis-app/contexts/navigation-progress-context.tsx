"use client";

import React, {
  createContext,
  use,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { IndeterminateTopProgressBar } from "@/components/ui/indeterminate-top-progress";
import {
  isNavigationTargetCurrentPage,
  navigationHrefMatchesPending,
} from "@/lib/navigation-target";
import { usePathname } from "next/navigation";

type NavigationProgressContextType = {
  /** Start rutebytte + toppstripe. Hopper over når `targetHref` er samme rute som nå. */
  startNavigation: (targetHref?: string) => void;
  /** Resolved href for lenken som navigeres til (maks én om gangen). */
  pendingHref: string | null;
};

const NavigationProgressContext = createContext<
  NavigationProgressContextType | undefined
>(undefined);

export function useNavigationProgress() {
  return use(NavigationProgressContext);
}

/** Spinner på sidebar-lenke — umiddelbart ved klikk (`startNavigation(href)`). */
export function useIsPendingNavigationHref(href: string): boolean {
  const ctx = useNavigationProgress();
  return navigationHrefMatchesPending(ctx?.pendingHref, href);
}

/**
 * Tynn progress bar i root ved intern plattform-navigasjon (sidebar, logo).
 * Lenke-feedback: `startNavigation(href)` setter `pendingHref` med én gang (spinner i sidebar).
 * Toppstripe (`IndeterminateTopProgressBar`) i tillegg under rutebytte.
 */
export function NavigationProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const startNavigation = useCallback(
    (targetHref?: string) => {
      if (targetHref && isNavigationTargetCurrentPage(pathname, targetHref)) {
        return;
      }
      if (targetHref) {
        setPendingHref(targetHref);
      }
      setIsNavigating(true);
    },
    [pathname],
  );

  const resolvedPendingHref =
    pendingHref != null && isNavigationTargetCurrentPage(pathname, pendingHref)
      ? null
      : pendingHref;

  useEffect(() => {
    if (!isNavigating) return;
    // Minimum synlig tid etter pathname-endring (unngår blink på stripe)
    const id = setTimeout(() => setIsNavigating(false), 200);
    return () => clearTimeout(id);
  }, [pathname, isNavigating]);

  const contextValue = useMemo(
    () => ({ startNavigation, pendingHref: resolvedPendingHref }),
    [startNavigation, resolvedPendingHref],
  );

  return (
    <NavigationProgressContext.Provider value={contextValue}>
      {children}
      {isNavigating ? (
        <IndeterminateTopProgressBar variant="navigation" />
      ) : null}
    </NavigationProgressContext.Provider>
  );
}
