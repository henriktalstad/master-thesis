"use client";

import { Suspense, createContext, use, type ReactNode } from "react";
import { useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { RouteSegmentLoading } from "@/components/ui/route-segment-loading";

const SearchParamsContext = createContext<ReadonlyURLSearchParams | null>(null);

type SearchParamsProviderProps = {
  children: ReactNode;
  label?: string;
  fallback?: ReactNode | null;
};

function SearchParamsProviderInner({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  return (
    <SearchParamsContext.Provider value={searchParams}>
      {children}
    </SearchParamsContext.Provider>
  );
}

/**
 * Én `useSearchParams()` per layout-grense med innebygd Suspense (Next.js-krav).
 * Barn bruker `useAppSearchParams()` i stedet for direkte Next-hook.
 */
export function SearchParamsProvider({
  children,
  label = "Laster …",
  fallback,
}: SearchParamsProviderProps) {
  const suspenseFallback =
    fallback === undefined ? (
      <RouteSegmentLoading label={label} subtle hideVisibleLabel />
    ) : (
      fallback
    );

  return (
    <Suspense fallback={suspenseFallback}>
      <SearchParamsProviderInner>{children}</SearchParamsProviderInner>
    </Suspense>
  );
}

export function useAppSearchParams(): ReadonlyURLSearchParams {
  const searchParams = use(SearchParamsContext);
  if (searchParams == null) {
    throw new Error(
      "useAppSearchParams må brukes innenfor SearchParamsProvider.",
    );
  }
  return searchParams;
}
