import "server-only";

import { mergeInfluxRowsIntoLatestByKey } from "@/lib/infraspawn/live-point-influx-utils";
import { mergeInfluxLiveIntoPoints } from "@/lib/infraspawn/merge-influx-live-into-points";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { CONTROL_SIGNAL_CATALOG_360102 } from "@/lib/sd-anlegg/control/control-signal-catalog";
import { resolvePointForCatalogEntryInContext } from "@/lib/sd-anlegg/control/resolve-control-catalog";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";
import { prisma } from "@/lib/db";
import { loadMpcResolveContext } from "@/services/mpc/load-mpc-resolve-context";
import { resolveEvalDatasetObjectIds } from "@/services/mpc/resolve-eval-dataset-object-ids";
import {
  resolveSourceInfluxCredentials,
  type InfraspawnSourceCredentialRow,
} from "@/services/infraspawn/source-influx-credentials";
import { queryInfluxLiveDisplayLatestRows } from "@/services/infraspawn/query-influx-live-display-latest";
import { buildObservedControlVector } from "@/services/mpc/build-u-meas";

export type LiveControlObservation = {
  uMeas: MpcControlVector | null;
  extractTempC: number | null;
  supplyTempMeasC: number | null;
  outdoorTempC: number | null;
  outdoorTempFrostC: number | null;
  outdoorTempBmsC: number | null;
  supplySetpointOperatorC: number | null;
  supplySetpointCalcC: number | null;
  coolingValveCommandPct: number | null;
  coolingValveFeedbackPct: number | null;
  observedAt: string | null;
  source: "influx-live" | "unavailable";
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function finiteOrNull(value: number | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function buildObservationFromEnrichedPoints(input: {
  points: readonly InfraspawnPointListItem[];
  context: Awaited<ReturnType<typeof loadMpcResolveContext>>;
  observedAt: string | null;
}): LiveControlObservation {
  let supplySetpointOperatorC: number | null = null;
  let supplySetpointCalcC: number | null = null;
  let supplyFanPct: number | undefined;
  let exhaustFanPct: number | undefined;
  let heatingValvePct: number | undefined;
  let coolingCommand: number | undefined;
  let coolingFeedback: number | undefined;
  let extractTempC: number | null = null;
  let supplyTempMeasC: number | null = null;
  let outdoorTempC: number | null = null;
  let outdoorTempFrostC: number | null = null;
  let outdoorTempBmsC: number | null = null;

  for (const entry of CONTROL_SIGNAL_CATALOG_360102) {
    const point = resolvePointForCatalogEntryInContext({
      points: input.points,
      entry,
      context: input.context,
    });
    const value = point?.lastValue;
    if (value == null || Number.isNaN(value)) continue;

    switch (entry.canonicalId) {
      case "supply.setpoint":
        supplySetpointOperatorC = round1(value);
        break;
      case "supply.setpoint_calculated":
        supplySetpointCalcC = round1(value);
        break;
      case "supply.fan.command":
        supplyFanPct = value;
        break;
      case "exhaust.fan.command":
        exhaustFanPct = value;
        break;
      case "heating.valve.command":
        heatingValvePct = value;
        break;
      case "cooling.valve.command":
        coolingCommand = value;
        break;
      case "cooling.valve.position":
        coolingFeedback = value;
        break;
      case "extract.temp":
        extractTempC = round1(value);
        break;
      case "supply.temp":
        supplyTempMeasC = round1(value);
        break;
      case "outdoor.temp":
        outdoorTempC = round1(value);
        break;
      case "outdoor.temp_frost":
        outdoorTempFrostC = round1(value);
        break;
      case "outdoor.temp_bms":
        outdoorTempBmsC = round1(value);
        break;
      default:
        break;
    }
  }

  const uMeas = buildObservedControlVector({
    supplySetpointC: supplySetpointOperatorC ?? undefined,
    supplySetpointCalcC: supplySetpointCalcC ?? undefined,
    supplyFanPct,
    exhaustFanPct,
    heatingValvePct,
    coolingValveCommandPct: coolingCommand,
    coolingValveFeedbackPct: coolingFeedback,
    outdoorTempC,
  });

  const hasData =
    uMeas != null ||
    extractTempC != null ||
    outdoorTempC != null ||
    supplyTempMeasC != null;

  return {
    uMeas,
    extractTempC,
    supplyTempMeasC,
    outdoorTempC,
    outdoorTempFrostC,
    outdoorTempBmsC,
    supplySetpointOperatorC,
    supplySetpointCalcC,
    coolingValveCommandPct: finiteOrNull(coolingCommand),
    coolingValveFeedbackPct: finiteOrNull(coolingFeedback),
    observedAt: input.observedAt,
    source: hasData ? "influx-live" : "unavailable",
  };
}

export function mergeLiveObservationIntoTimestep<
  T extends {
    uMeas?: import("@/lib/sd-anlegg/mpc/shared/types").MpcControlVector | null;
    extractTempC?: number | null;
    supplyTempMeasC?: number | null;
    outdoorTempC?: number | null;
    outdoorTempFrostC?: number | null;
    outdoorTempBmsC?: number | null;
    supplySetpointOperatorC?: number | null;
    supplySetpointCalcC?: number | null;
    coolingValveCommandPct?: number | null;
    coolingValveFeedbackPct?: number | null;
  },
>(step: T, live: LiveControlObservation): T {
  return {
    ...step,
    uMeas: live.uMeas ?? step.uMeas ?? null,
    extractTempC: live.extractTempC ?? step.extractTempC ?? null,
    supplyTempMeasC: live.supplyTempMeasC ?? step.supplyTempMeasC ?? null,
    outdoorTempC: live.outdoorTempC ?? step.outdoorTempC ?? null,
    outdoorTempFrostC: live.outdoorTempFrostC ?? step.outdoorTempFrostC ?? null,
    outdoorTempBmsC: live.outdoorTempBmsC ?? step.outdoorTempBmsC ?? null,
    supplySetpointOperatorC:
      live.supplySetpointOperatorC ?? step.supplySetpointOperatorC ?? null,
    supplySetpointCalcC: live.supplySetpointCalcC ?? step.supplySetpointCalcC ?? null,
    coolingValveCommandPct:
      live.coolingValveCommandPct ?? step.coolingValveCommandPct ?? null,
    coolingValveFeedbackPct:
      live.coolingValveFeedbackPct ?? step.coolingValveFeedbackPct ?? null,
  };
}

export async function loadLiveControlObservation(input: {
  buildingId: string;
  buildingSlug?: string;
  sourceId: string;
}): Promise<LiveControlObservation> {
  const empty: LiveControlObservation = {
    uMeas: null,
    extractTempC: null,
    supplyTempMeasC: null,
    outdoorTempC: null,
    outdoorTempFrostC: null,
    outdoorTempBmsC: null,
    supplySetpointOperatorC: null,
    supplySetpointCalcC: null,
    coolingValveCommandPct: null,
    coolingValveFeedbackPct: null,
    observedAt: null,
    source: "unavailable",
  };

  const mpcCtx = await loadMpcResolveContext({
    buildingId: input.buildingId,
    buildingSlug: input.buildingSlug,
    sourceId: input.sourceId,
  });

  const objectIds = resolveEvalDatasetObjectIds(mpcCtx.points, mpcCtx);
  if (objectIds.length === 0) return empty;

  const source = await prisma.infraspawnSource.findUnique({
    where: { id: input.sourceId },
    select: {
      id: true,
      influxDatabase: true,
      apiTokenEncrypted: true,
      metadata: true,
    },
  });
  if (!source) return empty;

  const credRow: InfraspawnSourceCredentialRow = {
    id: source.id,
    influxDatabase: source.influxDatabase,
    apiTokenEncrypted: source.apiTokenEncrypted,
    metadata: source.metadata,
  };
  const creds = resolveSourceInfluxCredentials([credRow]).get(source.id);
  if (!creds) return empty;

  let rows;
  try {
    rows = await queryInfluxLiveDisplayLatestRows({
      token: creds.token,
      database: creds.database,
      tableName: creds.tableName,
      host: creds.host,
      objectIds,
    });
  } catch (error) {
    console.warn("[live-control-observation] influx query failed:", {
      sourceId: input.sourceId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return empty;
  }

  if (rows.length === 0) return empty;

  const latestByKey = new Map<string, { value: number | null; sampledAt: string }>();
  mergeInfluxRowsIntoLatestByKey(latestByKey, source.id, rows);

  let observedAt: string | null = null;
  for (const row of rows) {
    const sampledAt = row.sampledAt;
    if (!sampledAt) continue;
    const iso = sampledAt.toISOString();
    if (!observedAt || iso > observedAt) {
      observedAt = iso;
    }
  }

  const enrichedPoints = mergeInfluxLiveIntoPoints(mpcCtx.points, latestByKey);
  return buildObservationFromEnrichedPoints({
    points: enrichedPoints,
    context: mpcCtx,
    observedAt,
  });
}
