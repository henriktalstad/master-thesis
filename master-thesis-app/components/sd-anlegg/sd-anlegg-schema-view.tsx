"use client";

import { useCallback } from "react";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdAnleggChartRangeHours } from "@/lib/infraspawn/sd-anlegg-chart-policy";
import { SdAnleggAhuProcessSchematic } from "./schematic/sd-anlegg-ahu-process-schematic";
import { SdAnleggHeatingCombinedSchematic } from "./schematic/sd-anlegg-heating-combined-schematic";
import { SdAnleggHeatingDistrictSchematic } from "./schematic/sd-anlegg-heating-district-schematic";
import { SdAnleggSumpPitsSchematic } from "./schematic/sd-anlegg-sump-pits-schematic";
import { SdAnleggTapWaterSchematic } from "./schematic/sd-anlegg-tap-water-schematic";
import {
  SCHEMATIC_EMPTY_CHART_RANGE_OPTIONS,
  SCHEMATIC_EMPTY_CHART_SERIES,
  SCHEMATIC_EMPTY_POINTS,
  SCHEMATIC_EMPTY_SELECTED_KEYS,
} from "./schematic/schematic-defaults";
import {
  HEATING_DISTRICT_COMBINED_ID,
  HEATING_DISTRICT_SECONDARY_CIRCUIT_ID,
  HEATING_SUMP_PITS_ID,
  HEATING_TAPWATER_DHW_ID,
  isAhuProcessSchemaTemplate,
} from "@/lib/sd-anlegg/schema-template-ids";
import type { SdAnleggChartSeries } from "./sd-anlegg-chart-data";

type Props = {
  buildingSlug: string;
  points?: InfraspawnPointListItem[];
  schemaTemplateId?: string | null;
  elementKey?: string | null;
  selectedKeys?: string[];
  onSelectPointsAction?: (points: InfraspawnPointListItem[]) => void;
  unitDisplayName?: string;
  selectedPoints?: InfraspawnPointListItem[];
  chartSeries?: SdAnleggChartSeries[];
  dataCoverage?: string | null;
  chartHours?: number;
  chartRangeOptions?: ReadonlyArray<{ hours: SdAnleggChartRangeHours; label: string }>;
  onChartHoursChangeAction?: (hours: SdAnleggChartRangeHours) => void;
  seriesLoading?: boolean;
  seriesError?: Error | null;
  seriesFetching?: boolean;
};

export function SdAnleggSchemaView({
  buildingSlug,
  points = SCHEMATIC_EMPTY_POINTS,
  schemaTemplateId = null,
  elementKey = null,
  selectedKeys = SCHEMATIC_EMPTY_SELECTED_KEYS,
  onSelectPointsAction,
  unitDisplayName,
  selectedPoints: _selectedPoints = SCHEMATIC_EMPTY_POINTS,
  chartSeries = SCHEMATIC_EMPTY_CHART_SERIES,
  dataCoverage = null,
  chartHours = 72,
  chartRangeOptions = SCHEMATIC_EMPTY_CHART_RANGE_OPTIONS,
  onChartHoursChangeAction,
  seriesLoading = false,
  seriesError = null,
  seriesFetching = false,
}: Props) {
  const handlePointSelect = useCallback(
    (point: InfraspawnPointListItem) => {
      onSelectPointsAction?.([point]);
    },
    [onSelectPointsAction],
  );

  if (points.length === 0) {
    return (
      <div className="flex h-[min(320px,45vh)] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/25 px-6 text-center text-sm text-muted-foreground dark:bg-muted/15">
        Ingen signaler med live data i dette skjemaet for valgt anlegg.
      </div>
    );
  }

  const heatingProcessSchematicProps = {
    buildingSlug,
    points,
    selectedKeys,
    onPointSelectAction: handlePointSelect,
    onSelectPointsAction,
    unitDisplayName,
    chartSeries,
    dataCoverage,
    chartHours,
    chartRangeOptions,
    onChartHoursChangeAction,
    seriesLoading,
    seriesError,
    seriesFetching,
    className: "min-h-0" as const,
  };

  if (isAhuProcessSchemaTemplate(schemaTemplateId)) {
    return (
      <SdAnleggAhuProcessSchematic
        buildingSlug={buildingSlug}
        points={points}
        elementKey={elementKey}
        schemaTemplateId={schemaTemplateId}
        selectedKeys={selectedKeys}
        onPointSelectAction={handlePointSelect}
        onSelectPointsAction={onSelectPointsAction}
        unitDisplayName={unitDisplayName}
        chartSeries={chartSeries}
        dataCoverage={dataCoverage}
        chartHours={chartHours}
        chartRangeOptions={chartRangeOptions}
        onChartHoursChangeAction={onChartHoursChangeAction}
        seriesLoading={seriesLoading}
        seriesError={seriesError}
        seriesFetching={seriesFetching}
        className="min-h-0"
      />
    );
  }

  if (schemaTemplateId === HEATING_DISTRICT_COMBINED_ID) {
    return <SdAnleggHeatingCombinedSchematic {...heatingProcessSchematicProps} />;
  }
  if (schemaTemplateId === HEATING_TAPWATER_DHW_ID) {
    return <SdAnleggTapWaterSchematic {...heatingProcessSchematicProps} />;
  }
  if (schemaTemplateId === HEATING_SUMP_PITS_ID) {
    return <SdAnleggSumpPitsSchematic {...heatingProcessSchematicProps} />;
  }
  if (schemaTemplateId === HEATING_DISTRICT_SECONDARY_CIRCUIT_ID) {
    return (
      <SdAnleggHeatingDistrictSchematic
        {...heatingProcessSchematicProps}
        elementKey={elementKey}
      />
    );
  }

  return (
    <div className="flex h-[min(320px,45vh)] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/25 px-6 text-center text-sm text-muted-foreground dark:bg-muted/15">
      Prosess-skjema er ikke tilgjengelig for dette anlegget.
    </div>
  );
}
