"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  filterSdAnleggChartPointsForSlot,
  pickDefaultSdAnleggChartPointsForSlot,
} from "@/lib/sd-anlegg/sd-anlegg-chart-point-filter";
import { sdAnleggPointKey } from "@/components/sd-anlegg/sd-anlegg-point-key";
import type { SdAnleggSchemaHistoryTarget } from "./sd-anlegg-schema-history-dialog";

function resolveInitialChartPoints(
  target: SdAnleggSchemaHistoryTarget,
): InfraspawnPointListItem[] {
  const chartable = filterSdAnleggChartPointsForSlot(
    target.slotRole,
    target.relatedPoints,
  );
  const defaults = pickDefaultSdAnleggChartPointsForSlot(
    target.slotRole,
    target.relatedPoints,
  );
  if (defaults.length > 0) return defaults;
  if (
    target.primaryPoint &&
    chartable.some(
      (point) => sdAnleggPointKey(point) === sdAnleggPointKey(target.primaryPoint!),
    )
  ) {
    return [target.primaryPoint];
  }
  return chartable.slice(0, 1);
}

export function useSchemaHistoryDialog(
  selectSlotPoints: (slotPoints: readonly InfraspawnPointListItem[]) => void,
  buildingSlug: string,
) {
  const queryClient = useQueryClient();
  const [activeTarget, setActiveTarget] = useState<SdAnleggSchemaHistoryTarget | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const invalidateChart = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ["sd-anlegg", "series-batch", buildingSlug],
    });
  }, [buildingSlug, queryClient]);

  const openTarget = useCallback(
    (target: SdAnleggSchemaHistoryTarget | null | undefined) => {
      if (!target?.primaryPoint) return;
      const chartPoints = resolveInitialChartPoints(target);
      if (chartPoints.length > 0) {
        selectSlotPoints(chartPoints);
      }
      invalidateChart();
      setActiveTarget(target);
      setDialogOpen(true);
    },
    [invalidateChart, selectSlotPoints],
  );

  const selectChartPoint = useCallback(
    (point: InfraspawnPointListItem) => {
      if (!activeTarget) return;
      const chartable = filterSdAnleggChartPointsForSlot(
        activeTarget.slotRole,
        activeTarget.relatedPoints,
      );
      if (!chartable.some((entry) => sdAnleggPointKey(entry) === sdAnleggPointKey(point))) return;
      selectSlotPoints([point]);
      invalidateChart();
    },
    [activeTarget, invalidateChart, selectSlotPoints],
  );

  const closeDialog = useCallback(() => setDialogOpen(false), []);

  return { activeTarget, dialogOpen, openTarget, closeDialog, selectChartPoint };
}
