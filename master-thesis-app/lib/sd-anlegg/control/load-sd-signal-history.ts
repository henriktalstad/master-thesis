import {
  aggregateBacnetRowsTo1m,
  aggregateBacnetRowsTo5m,
} from "@/lib/infraspawn/bucket-aggregate";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { loadSdAnleggChartSeriesBatch } from "@/lib/infraspawn/sd-anlegg-series";
import type { SdAnleggInfluxCredentials } from "@/lib/infraspawn/sd-anlegg-series";
import { queryInfluxLivePointRows } from "@/services/infraspawn/sd-anlegg-live";
import { CONTROL_SIGNAL_CATALOG_360102 } from "./control-signal-catalog";
import type { ControlSdHourlyProfile } from "./control-sd-calibration";
import { bucketSamplesByHour } from "./control-time-buckets";
import {
  bucketSamplesByMpcStep,
  bucketSamplesByStepMinutes,
} from "@/lib/sd-anlegg/mpc/shared/time-grid";
import { resolvePointForCatalogEntry } from "./resolve-control-signals";
import {
  finalizeSdProfileCoolingValve,
  resolveCoolingValveFeedbackObjectId,
} from "./resolve-cooling-valve-pct";

import {
  SD_CALIBRATION_CANONICAL_IDS,
  type SdCalibrationCanonicalId,
} from "./sd-calibration-ids";

export type { ControlSdHourlyProfile } from "./control-sd-calibration";

const CANONICAL_TO_PROFILE_KEY: Record<
  SdCalibrationCanonicalId,
  keyof Omit<ControlSdHourlyProfile, "hour">
> = {
  "supply.setpoint": "supplySetpointC",
  "supply.setpoint_calculated": "supplySetpointCalcC",
  "extract.setpoint": "extractSetpointC",
  "supply.fan.command": "supplyFanPct",
  "exhaust.fan.command": "exhaustFanPct",
  "heating.valve.command": "heatingValvePct",
  "cooling.valve.command": "coolingValvePct",
  "extract.temp": "extractTempC",
  "supply.temp": "supplyTempC",
};

export async function loadSdCalibrationHistory(input: {
  sourceId: string;
  points: readonly InfraspawnPointListItem[];
  hours: number;
  influx?: SdAnleggInfluxCredentials;
}): Promise<{
  profiles: ControlSdHourlyProfile[];
  seriesCoveragePct: number;
  loadedCanonicalIds: SdCalibrationCanonicalId[];
}> {
  const resolved = SD_CALIBRATION_CANONICAL_IDS.map((canonicalId) => {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === canonicalId,
    );
    if (!entry) return null;
    const point = resolvePointForCatalogEntry(input.points, entry);
    if (!point) return null;
    return { canonicalId, objectId: point.objectId };
  }).filter(
    (
      row,
    ): row is { canonicalId: SdCalibrationCanonicalId; objectId: string } =>
      row != null,
  );

  if (resolved.length === 0) {
    return { profiles: [], seriesCoveragePct: 0, loadedCanonicalIds: [] };
  }

  const feedbackObjectId = resolveCoolingValveFeedbackObjectId(input.points);
  const objectIds = [
    ...resolved.map((r) => r.objectId),
    ...(feedbackObjectId ? [feedbackObjectId] : []),
  ];

  const seriesBatch = await loadSdAnleggChartSeriesBatch({
    sourceId: input.sourceId,
    objectIds,
    hours: input.hours,
    influx: input.influx,
  });

  const hourlyByCanonical = new Map<
    SdCalibrationCanonicalId,
    Map<string, number>
  >();

  for (const { canonicalId, objectId } of resolved) {
    const series = seriesBatch.get(objectId);
    if (!series?.samples.length) continue;
    hourlyByCanonical.set(canonicalId, bucketSamplesByHour(series.samples));
  }

  const feedbackByHour =
    feedbackObjectId != null
      ? bucketSamplesByHour(
          seriesBatch.get(feedbackObjectId)?.samples ?? [],
        )
      : undefined;

  const allHours = new Set<string>();
  for (const map of hourlyByCanonical.values()) {
    for (const key of map.keys()) allHours.add(key);
  }

  const profiles: ControlSdHourlyProfile[] = [...allHours]
    .toSorted()
    .map((hourKey) => {
      const profile: ControlSdHourlyProfile = {
        hour: hourKeyToIsoUtc(hourKey),
      };
      for (const [canonicalId, map] of hourlyByCanonical) {
        const value = map.get(hourKey);
        if (value == null) continue;
        const key = CANONICAL_TO_PROFILE_KEY[canonicalId];
        profile[key] = value;
      }
      return finalizeSdProfileCoolingValve(profile, {
        feedbackByTimeKey: feedbackByHour,
        timeKey: hourKey,
      });
    });

  const loadedCanonicalIds = [...hourlyByCanonical.keys()];
  const seriesCoveragePct = Math.round(
    (loadedCanonicalIds.length / SD_CALIBRATION_CANONICAL_IDS.length) * 100,
  );

  return { profiles, seriesCoveragePct, loadedCanonicalIds };
}

/** 15-min SD-profiler for signal-sammenligning (samme kilde som grafer). */
export async function loadSdQuarterCalibrationHistory(input: {
  sourceId: string;
  points: readonly InfraspawnPointListItem[];
  hours: number;
  influx?: SdAnleggInfluxCredentials;
}): Promise<{
  profiles: ControlSdHourlyProfile[];
  seriesCoveragePct: number;
  loadedCanonicalIds: SdCalibrationCanonicalId[];
}> {
  const resolved = SD_CALIBRATION_CANONICAL_IDS.map((canonicalId) => {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === canonicalId,
    );
    if (!entry) return null;
    const point = resolvePointForCatalogEntry(input.points, entry);
    if (!point) return null;
    return { canonicalId, objectId: point.objectId };
  }).filter(
    (
      row,
    ): row is { canonicalId: SdCalibrationCanonicalId; objectId: string } =>
      row != null,
  );

  if (resolved.length === 0) {
    return { profiles: [], seriesCoveragePct: 0, loadedCanonicalIds: [] };
  }

  const feedbackObjectId = resolveCoolingValveFeedbackObjectId(input.points);
  const objectIds = [
    ...resolved.map((r) => r.objectId),
    ...(feedbackObjectId ? [feedbackObjectId] : []),
  ];

  const seriesBatch = await loadSdAnleggChartSeriesBatch({
    sourceId: input.sourceId,
    objectIds,
    hours: input.hours,
    influx: input.influx,
  });

  const quarterByCanonical = new Map<
    SdCalibrationCanonicalId,
    Map<string, number>
  >();

  for (const { canonicalId, objectId } of resolved) {
    const series = seriesBatch.get(objectId);
    if (!series?.samples.length) continue;
    quarterByCanonical.set(canonicalId, bucketSamplesByMpcStep(series.samples));
  }

  const feedbackByStep =
    feedbackObjectId != null
      ? bucketSamplesByMpcStep(
          seriesBatch.get(feedbackObjectId)?.samples ?? [],
        )
      : undefined;

  const allSteps = new Set<string>();
  for (const map of quarterByCanonical.values()) {
    for (const key of map.keys()) allSteps.add(key);
  }

  const profiles: ControlSdHourlyProfile[] = [...allSteps]
    .toSorted()
    .map((stepIso) => {
      const profile: ControlSdHourlyProfile = { hour: stepIso };
      for (const [canonicalId, map] of quarterByCanonical) {
        const value = map.get(stepIso);
        if (value == null) continue;
        const key = CANONICAL_TO_PROFILE_KEY[canonicalId];
        profile[key] = value;
      }
      return finalizeSdProfileCoolingValve(profile, {
        feedbackByTimeKey: feedbackByStep,
        timeKey: stepIso,
      });
    });

  const loadedCanonicalIds = [...quarterByCanonical.keys()];
  const seriesCoveragePct = Math.round(
    (loadedCanonicalIds.length / SD_CALIBRATION_CANONICAL_IDS.length) * 100,
  );

  return { profiles, seriesCoveragePct, loadedCanonicalIds };
}

/** 1- eller 5-min SD-profiler direkte fra Influx (rå BACnet → bucket). */
export async function loadSdFineCalibrationHistory(input: {
  sourceId: string;
  points: readonly InfraspawnPointListItem[];
  hours: number;
  stepMinutes: 1 | 5;
  influx: SdAnleggInfluxCredentials;
}): Promise<{
  profiles: ControlSdHourlyProfile[];
  seriesCoveragePct: number;
  loadedCanonicalIds: SdCalibrationCanonicalId[];
}> {
  const resolved = SD_CALIBRATION_CANONICAL_IDS.map((canonicalId) => {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === canonicalId,
    );
    if (!entry) return null;
    const point = resolvePointForCatalogEntry(input.points, entry);
    if (!point) return null;
    return { canonicalId, objectId: point.objectId };
  }).filter(
    (
      row,
    ): row is { canonicalId: SdCalibrationCanonicalId; objectId: string } =>
      row != null,
  );

  if (resolved.length === 0) {
    return { profiles: [], seriesCoveragePct: 0, loadedCanonicalIds: [] };
  }

  const feedbackObjectId = resolveCoolingValveFeedbackObjectId(input.points);
  const objectIds = [
    ...resolved.map((r) => r.objectId),
    ...(feedbackObjectId ? [feedbackObjectId] : []),
  ];

  const lookbackMinutes = Math.max(1, Math.round(input.hours * 60));
  const stepsExpected = Math.ceil(lookbackMinutes / input.stepMinutes);
  const maxRows = Math.min(
    stepsExpected * objectIds.length + objectIds.length,
    250_000,
  );
  let rows;
  try {
    rows = await queryInfluxLivePointRows({
      token: input.influx.token,
      database: input.influx.database,
      tableName: input.influx.tableName,
      objectIds,
      lookbackMinutes,
      maxRows,
    });
  } catch {
    return { profiles: [], seriesCoveragePct: 0, loadedCanonicalIds: [] };
  }

  if (rows.length === 0) {
    return { profiles: [], seriesCoveragePct: 0, loadedCanonicalIds: [] };
  }

  const aggregateFn =
    input.stepMinutes === 1 ? aggregateBacnetRowsTo1m : aggregateBacnetRowsTo5m;
  const rowsByObject = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = rowsByObject.get(row.objectId) ?? [];
    list.push(row);
    rowsByObject.set(row.objectId, list);
  }

  const stepByCanonical = new Map<
    SdCalibrationCanonicalId,
    Map<string, number>
  >();

  for (const { canonicalId, objectId } of resolved) {
    const objectRows = rowsByObject.get(objectId) ?? [];
    if (objectRows.length === 0) continue;
    const aggregated = aggregateFn(objectRows);
    const samples = aggregated.map((row) => ({
      t: row.sampledAt.toISOString(),
      value: row.valueNum,
    }));
    stepByCanonical.set(
      canonicalId,
      bucketSamplesByStepMinutes(samples, input.stepMinutes),
    );
  }

  const feedbackByStep =
    feedbackObjectId != null
      ? bucketSamplesByStepMinutes(
          aggregateFn(rowsByObject.get(feedbackObjectId) ?? []).map((row) => ({
            t: row.sampledAt.toISOString(),
            value: row.valueNum,
          })),
          input.stepMinutes,
        )
      : undefined;

  const allSteps = new Set<string>();
  for (const map of stepByCanonical.values()) {
    for (const key of map.keys()) allSteps.add(key);
  }

  const profiles: ControlSdHourlyProfile[] = [...allSteps]
    .toSorted()
    .map((stepIso) => {
      const profile: ControlSdHourlyProfile = { hour: stepIso };
      for (const [canonicalId, map] of stepByCanonical) {
        const value = map.get(stepIso);
        if (value == null) continue;
        const key = CANONICAL_TO_PROFILE_KEY[canonicalId];
        profile[key] = value;
      }
      return finalizeSdProfileCoolingValve(profile, {
        feedbackByTimeKey: feedbackByStep,
        timeKey: stepIso,
      });
    });

  const loadedCanonicalIds = [...stepByCanonical.keys()];
  const seriesCoveragePct = Math.round(
    (loadedCanonicalIds.length / SD_CALIBRATION_CANONICAL_IDS.length) * 100,
  );

  return { profiles, seriesCoveragePct, loadedCanonicalIds };
}

function hourKeyToIsoUtc(hourKey: string): string {
  const [datePart, hourPart] = hourKey.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(
    Date.UTC(y, m - 1, d, Number(hourPart), 0, 0, 0),
  ).toISOString();
}
