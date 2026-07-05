import "server-only";

import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { mergeInfluxRowsIntoLatestByKey } from "@/lib/infraspawn/live-point-influx-utils";
import { mergeInfluxLiveIntoPoints } from "@/lib/infraspawn/merge-influx-live-into-points";
import { SD_ANLEGG_LIVE_INFLUX_STREAM_LOOKBACK_MINUTES } from "@/lib/infraspawn/live-display-policy";
import {
  resolveSourceInfluxCredentials,
  type InfraspawnSourceCredentialRow,
} from "@/services/infraspawn/source-influx-credentials";
import { queryInfluxLiveDisplayLatestRows } from "@/services/infraspawn/sd-anlegg-live";

export type EnrichSdAnleggInfluxLiveOptions = {
  influxObjectIds?: readonly string[];
  tailObjectIds?: readonly string[];
};

export async function enrichSdAnleggPointsWithInfluxLive(
  points: InfraspawnPointListItem[],
  sources: readonly InfraspawnSourceCredentialRow[],
  options: EnrichSdAnleggInfluxLiveOptions = {},
): Promise<InfraspawnPointListItem[]> {
  if (points.length === 0 || sources.length === 0) return points;

  const influxFilter =
    options.influxObjectIds && options.influxObjectIds.length > 0
      ? new Set(options.influxObjectIds)
      : null;

  const objectIdsBySource = new Map<string, string[]>();
  for (const point of points) {
    if (influxFilter && !influxFilter.has(point.objectId)) continue;
    const list = objectIdsBySource.get(point.sourceId);
    if (list) {
      if (!list.includes(point.objectId)) list.push(point.objectId);
    } else {
      objectIdsBySource.set(point.sourceId, [point.objectId]);
    }
  }

  const credentialsBySource = resolveSourceInfluxCredentials(sources);
  const latestByKey = new Map<
    string,
    { value: number | null; sampledAt: string }
  >();

  await Promise.all(
    sources.map(async (source) => {
      const objectIds = objectIdsBySource.get(source.id);
      const creds = credentialsBySource.get(source.id);
      if (!objectIds?.length || !creds) return;

      try {
        const rows = await queryInfluxLiveDisplayLatestRows({
          token: creds.token,
          database: creds.database,
          tableName: creds.tableName,
          host: creds.host,
          objectIds,
          streamLookbackMinutes: SD_ANLEGG_LIVE_INFLUX_STREAM_LOOKBACK_MINUTES,
          tailObjectIds: options.tailObjectIds,
        });
        mergeInfluxRowsIntoLatestByKey(latestByKey, source.id, rows);
      } catch (error) {
        console.warn("[infraspawn.live]", {
          sourceId: source.id,
          message:
            error instanceof Error ? error.message : "Ukjent Influx-feil",
        });
      }
    }),
  );

  return mergeInfluxLiveIntoPoints(points, latestByKey);
}
