"use client";

import { useCallback, useMemo, useState } from "react";
import { useAppSearchParams } from "@/contexts/search-params-context";
import type {
  InfraspawnBuildingPageData,
  InfraspawnPointListItem,
} from "@/lib/infraspawn/types";
import {
  DEFAULT_DOMAIN_POINT_LIST_FILTER,
  type DomainPointListFilterId,
} from "@/lib/infraspawn/domain-point-list-filters";
import {
  SD_ANLEGG_CHART_RANGE_OPTIONS,
  SD_ANLEGG_MAX_SERIES_HOURS,
  SD_ANLEGG_SERIES_HOURS,
  type SdAnleggChartRangeHours,
} from "@/lib/infraspawn/sd-anlegg-chart-policy";
import { formatInfraspawnPointLabel } from "@/lib/infraspawn/display-format";
import type { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import { resolveSdAnleggKpiSlots } from "@/lib/sd-anlegg/kpi-slots";
import { useSdAnleggEffectiveIdentification } from "./use-sd-anlegg-effective-identification";
import { buildSdAnleggPointsScopeKey, useSdAnleggWorkspaceLivePoints } from "@/queries/infraspawn";
import { SD_ANLEGG_MAX_CHART_SERIES } from "./sd-anlegg-chart-data";
import { sdAnleggPointKey } from "./sd-anlegg-point-key";
import type { SdAnleggWorkspaceView } from "./sd-anlegg-workspace-tabs";
import { useSdAnleggWorkspaceChart } from "./use-sd-anlegg-workspace-chart";
import { useSdAnleggWorkspaceSchemaContext } from "./use-sd-anlegg-workspace-schema-context";
import { useSdAnleggWorkspaceNavigation } from "./use-sd-anlegg-workspace-navigation";
import { useSdAnleggWorkspacePoints } from "./use-sd-anlegg-workspace-points";

type Input = {
  pageData: InfraspawnBuildingPageData;
  initialPoints: InfraspawnPointListItem[];
  canEditLayout?: boolean;
  domain?: InfraspawnSystemDomain;
  unitObjectIds?: readonly string[];
  scopeId?: string;
  unitKey?: string;
};

export function useSdAnleggBuildingWorkspace({
  pageData,
  initialPoints,
  canEditLayout = false,
  domain,
  unitObjectIds,
  scopeId,
  unitKey,
}: Input) {
  const searchParams = useAppSearchParams();
  const urlViewParam = searchParams.get("view");
  const initialViewFromUrl: SdAnleggWorkspaceView | null =
    urlViewParam === "schema" || urlViewParam === "list" ? urlViewParam : null;

  const [chartHours, setChartHours] = useState<SdAnleggChartRangeHours>(
    SD_ANLEGG_SERIES_HOURS,
  );

  const pointsScopeKey = useMemo(
    () =>
      buildSdAnleggPointsScopeKey({
        domain,
        scopeId,
        unitObjectIds,
        unitKey,
      }),
    [domain, scopeId, unitObjectIds, unitKey],
  );

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<DomainPointListFilterId>(
    DEFAULT_DOMAIN_POINT_LIST_FILTER,
  );
  const [filterScopeKey, setFilterScopeKey] = useState(pointsScopeKey);

  if (pointsScopeKey !== filterScopeKey) {
    setFilterScopeKey(pointsScopeKey);
    setSearch("");
    setCategory(DEFAULT_DOMAIN_POINT_LIST_FILTER);
  }

  const workspaceLiveScope = useMemo(
    () => ({
      domain,
      unitObjectIds,
      scopeId,
      unitKey,
    }),
    [domain, unitObjectIds, scopeId, unitKey],
  );

  const pointsQuery = useSdAnleggWorkspaceLivePoints(pageData.buildingSlug, {
    scope: workspaceLiveScope,
    scopeKey: pointsScopeKey,
    initialData: initialPoints,
  });
  const scopedLivePoints = pointsQuery.data ?? initialPoints;

  const { applyToPoints, schemaSlotOverrides } = useSdAnleggEffectiveIdentification();
  const effectiveAllPoints = useMemo(
    () => applyToPoints(scopedLivePoints),
    [scopedLivePoints, applyToPoints],
  );

  const scopePointsForInference = useMemo(() => {
    if (!unitObjectIds?.length) return effectiveAllPoints;
    const ids = new Set(unitObjectIds);
    return effectiveAllPoints.filter((point) => ids.has(point.objectId));
  }, [effectiveAllPoints, unitObjectIds]);

  const { schemaTemplate, elementKey } = useSdAnleggWorkspaceSchemaContext({
    buildingSlug: pageData.buildingSlug,
    domain,
    unitObjectIds,
    scopeId,
    unitKey,
    scopePointsForInference,
    pointsScopeKey,
  });

  const {
    points,
    pointsByKey,
    pointsIsError,
    pointsError,
    showPointsLoading,
    resolveSelectedPoints,
  } = useSdAnleggWorkspacePoints({
    points: effectiveAllPoints,
    pointsIsPending: pointsQuery.isPending,
    pointsIsError: pointsQuery.isError,
    pointsError:
      pointsQuery.error instanceof Error
        ? pointsQuery.error
        : pointsQuery.error != null
          ? new Error("Kunne ikke laste signaler")
          : null,
  });

  const { view, setView, selectedKeys, setSelectedKeys } =
    useSdAnleggWorkspaceNavigation({
      buildingSlug: pageData.buildingSlug,
      initialViewFromUrl,
      pointsScopeKey,
      points,
      pointsByKey,
      schemaTemplateId: schemaTemplate?.id,
      elementKey,
      schemaSlotOverrides,
    });

  const selectedPoints = useMemo(
    () => resolveSelectedPoints(selectedKeys),
    [resolveSelectedPoints, selectedKeys],
  );

  const {
    chartSeries,
    dataCoverage,
    seriesLoading,
    seriesError,
    seriesFetching,
  } = useSdAnleggWorkspaceChart({
    buildingSlug: pageData.buildingSlug,
    selectedPoints,
    chartHours,
  });

  const kpiSlots = useMemo(
    () => resolveSdAnleggKpiSlots(points, unitKey),
    [points, unitKey],
  );

  const clearSelectedPoints = useCallback(() => {
    setSelectedKeys([]);
  }, [setSelectedKeys]);

  const togglePoint = useCallback(
    (point: InfraspawnPointListItem) => {
      const key = sdAnleggPointKey(point);
      setSelectedKeys((prev) => {
        if (prev.includes(key)) {
          return prev.filter((k) => k !== key);
        }
        if (prev.length >= SD_ANLEGG_MAX_CHART_SERIES) return prev;
        return [...prev, key];
      });
    },
    [setSelectedKeys],
  );

  const selectProcessSlotPoints = useCallback(
    (slotPoints: InfraspawnPointListItem[]) => {
      const keys = slotPoints
        .slice(0, SD_ANLEGG_MAX_CHART_SERIES)
        .map((point) => sdAnleggPointKey(point));
      setSelectedKeys(keys);
    },
    [setSelectedKeys],
  );

  const chartTitle =
    selectedPoints.length === 0
      ? "Velg signaler til graf"
      : selectedPoints.length === 1
        ? formatInfraspawnPointLabel(selectedPoints[0]!)
        : "Graf";

  return {
    view,
    setView,
    canEditLayout,
    schemaTemplate,
    elementKey,
    kpiSlots,
    selectProcessSlotPoints,
    search,
    setSearch,
    category,
    setCategory,
    chartHours,
    setChartHours,
    chartRangeOptions: SD_ANLEGG_CHART_RANGE_OPTIONS.filter(
      (option) => option.hours <= SD_ANLEGG_MAX_SERIES_HOURS,
    ),
    points,
    pointsIsError,
    pointsError,
    selectedKeys,
    setSelectedKeys,
    selectedPoints,
    togglePoint,
    clearSelectedPoints,
    chartSeries,
    chartTitle,
    dataCoverage,
    seriesLoading,
    seriesError,
    seriesFetching,
    showPointsLoading,
    pointsScopeKey,
  };
}
