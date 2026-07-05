export type InfraspawnChartSeriesEntry = {
  sourceId: string;
  objectId: string;
  samples: readonly { t: string; value: number | null }[];
  unit: string | null;
};

import type { InfraspawnPointValueSource } from "@/lib/infraspawn/point-value-source";

export type InfraspawnPointListItem = {
  sourceId: string;
  sourceLabel: string;
  objectId: string;
  objectName: string | null;
  description: string | null;
  unit: string | null;
  lastValue: number | null;
  lastSampledAt: string | null;
  valueSource: InfraspawnPointValueSource;
  quality: string | null;
  statusFault: boolean;
  statusInAlarm: boolean;
  statusOutOfService: boolean;
  statusOverridden: boolean;
};

export type InfraspawnBuildingHealthSummary = {
  pointCount: number;
  unhealthyPointCount: number;
  alarmPointCount: number;
  faultPointCount: number;
  outOfServicePointCount: number;
  noValuePointCount: number;
  oldestSampleAt: string | null;
  newestSampleAt: string | null;
  /** Alder på nyeste måling (minutter), ikke sync-lag. */
  newestSampleAgeMinutes: number | null;
  lastSuccessfulSyncAt: string | null;
  samplesLast24h: number;
};

export type InfraspawnAnleggsenhetSummary = {
  id: string;
  unitKey: string;
  sourceId: string;
  sourceLabel: string;
  displayName: string;
  slug: string;
  pointCount: number;
  primaryDomain: string;
  detectionConfidence: "high" | "medium" | "low";
  detectionMethod:
    | "source"
    | "prefix"
    | "ungrouped"
    | "equipment_band"
    | "bacnet_role";
};

export type InfraspawnBuildingPageData = {
  buildingId: string;
  buildingName: string;
  buildingSlug: string;
  sources: {
    id: string;
    label: string;
    lastSuccessfulSyncAt: string | null;
    syncStatus: string | null;
    lastError: string | null;
    pointCount: number;
  }[];
  anleggsenheter: InfraspawnAnleggsenhetSummary[];
  oldestSuccessfulSyncAt: string | null;
  health: InfraspawnBuildingHealthSummary;
};

export type InfraspawnBacnetRow = {
  objectId: string;
  sampledAt: Date;
  valueNum: number | null;
  quality: string | null;
  objectName: string | null;
  description: string | null;
  unit: string | null;
  raw: Record<string, unknown>;
};

export type ThesisBuildingContext = {
  buildingId: string;
  buildingName: string;
  buildingSlug: string;
  sources: {
    id: string;
    label: string;
    integrationId: string;
  }[];
};
