"use client";

import { useMemo } from "react";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  buildSdAnleggPointMap,
  resolveSdAnleggSelectedPoints,
} from "./sd-anlegg-point-key";

type Input = {
  points: InfraspawnPointListItem[];
  pointsIsPending?: boolean;
  pointsIsError?: boolean;
  pointsError?: Error | null;
};

export function useSdAnleggWorkspacePoints({
  points,
  pointsIsPending = false,
  pointsIsError = false,
  pointsError = null,
}: Input) {
  const pointsByKey = useMemo(() => buildSdAnleggPointMap(points), [points]);

  return {
    points,
    pointsByKey,
    pointsIsError,
    pointsError,
    showPointsLoading: pointsIsPending && points.length === 0,
    resolveSelectedPoints: (selectedKeys: string[]) =>
      resolveSdAnleggSelectedPoints(selectedKeys, pointsByKey),
  };
}
