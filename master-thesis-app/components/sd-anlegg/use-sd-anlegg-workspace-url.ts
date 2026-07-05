"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSearchParams } from "@/contexts/search-params-context";
import { parseWorkspacePointParam } from "@/lib/sd-anlegg/resolve-signal-deep-link";
import type { SdAnleggWorkspaceView } from "./sd-anlegg-workspace-tabs";

const VIEW_PARAM = "view";
const POINT_PARAM = "point";

function viewStorageKey(buildingSlug: string): string {
  return `sd-anlegg-view:${buildingSlug}`;
}

export function useSdAnleggWorkspaceUrlSync(input: {
  buildingSlug: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useAppSearchParams();

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const before = searchParams.toString();
      const params = new URLSearchParams(before);
      mutate(params);
      const after = params.toString();
      if (after === before) return;
      router.replace(after ? `${pathname}?${after}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const pointParam = searchParams.get(POINT_PARAM);
  const urlPoint = parseWorkspacePointParam(pointParam);

  const syncViewToUrl = useCallback(
    (view: SdAnleggWorkspaceView) => {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(viewStorageKey(input.buildingSlug), view);
      }
      replaceParams((params) => {
        const current = params.get(VIEW_PARAM);
        if (view === "list") {
          if (!current) return;
          params.delete(VIEW_PARAM);
          return;
        }
        if (current === view) return;
        params.set(VIEW_PARAM, view);
      });
    },
    [input.buildingSlug, replaceParams],
  );

  const syncPointToUrl = useCallback(
    (pointKey: string | null) => {
      replaceParams((params) => {
        const current = params.get(POINT_PARAM);
        if (!pointKey) {
          if (!current) return;
          params.delete(POINT_PARAM);
          return;
        }
        if (current === pointKey) return;
        params.set(POINT_PARAM, pointKey);
      });
    },
    [replaceParams],
  );

  return {
    urlPoint,
    syncViewToUrl,
    syncPointToUrl,
  };
}

export function wrapSdAnleggViewSetter(
  setView: (view: SdAnleggWorkspaceView) => void,
  syncViewToUrl: (view: SdAnleggWorkspaceView) => void,
): (view: SdAnleggWorkspaceView) => void {
  return (view) => {
    setView(view);
    syncViewToUrl(view);
  };
}

export function readSdAnleggStoredView(
  buildingSlug: string,
): SdAnleggWorkspaceView | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(viewStorageKey(buildingSlug));
  return stored === "schema" || stored === "list" ? stored : null;
}
