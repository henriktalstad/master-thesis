import "server-only";

import type { InfraspawnAlarmKind } from "@/generated/client/enums";
import type { InfraspawnBacnetRow } from "@/lib/infraspawn/types";
import { prisma } from "@/lib/db";
import {
  buildOpenAlarmIndex,
  closeOpenAlarmEvents,
  infraspawnAlarmOpenDedupeKey,
  loadOpenAlarmsForObjects,
  openAlarmsIfAbsent,
  takeOpenAlarmsForKind,
  type OpenInfraspawnAlarmInsert,
} from "@/lib/infraspawn/alarm";
import { inferInfraspawnAlarmSeverity } from "@/lib/infraspawn/alarm-severity";
import { formatInfraspawnPointLabel } from "@/lib/infraspawn/display-format";
import {
  buildInfraspawnPointRawMetadata,
  parseInfraspawnPointStatusMetadata,
} from "@/lib/infraspawn/point-metadata";
import {
  diffAlarmKinds,
  extractPointAlarmStateFromRawMetadata,
  type PointAlarmState,
} from "@/lib/infraspawn/point-alarm-state";
import { inferInfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";

export type { PointAlarmState };
export { diffAlarmKinds, extractPointAlarmStateFromRawMetadata };

export function extractPointAlarmStateFromRow(
  row: InfraspawnBacnetRow,
): PointAlarmState {
  const metadata = parseInfraspawnPointStatusMetadata(
    buildInfraspawnPointRawMetadata(row),
  );
  return {
    alarm: metadata?.status_inAlarm ?? false,
    fault: metadata?.status_fault ?? false,
    outOfService: metadata?.status_outOfService ?? false,
  };
}

function alarmTextForRow(row: InfraspawnBacnetRow): string {
  return (
    row.objectName?.trim() ||
    row.description?.trim() ||
    formatInfraspawnPointLabel({
      objectId: row.objectId,
      objectName: row.objectName,
      description: row.description,
      unit: row.unit,
    })
  );
}

export async function detectInfraspawnAlarmTransitions(input: {
  sourceId: string;
  buildingId: string;
  rows: InfraspawnBacnetRow[];
}): Promise<{ activated: number; cleared: number }> {
  const uniqueRows = new Map<string, InfraspawnBacnetRow>();
  for (const row of input.rows) {
    uniqueRows.set(row.objectId, row);
  }
  if (uniqueRows.size === 0) {
    return { activated: 0, cleared: 0 };
  }

  const objectIds = Array.from(uniqueRows.keys());
  const [previousMeta, openEvents] = await Promise.all([
    prisma.infraspawnBacnetPointMeta.findMany({
      where: {
        sourceId: input.sourceId,
        objectId: { in: objectIds },
      },
      select: {
        objectId: true,
        objectName: true,
        description: true,
        unit: true,
        rawMetadata: true,
      },
    }),
    loadOpenAlarmsForObjects({
      sourceId: input.sourceId,
      objectIds,
    }),
  ]);

  const previousByObjectId = new Map(
    previousMeta.map((meta) => [meta.objectId, meta]),
  );

  const index = buildOpenAlarmIndex(openEvents);
  const existingOpenDedupeKeys = new Set(index.dedupeKeys);
  for (const event of openEvents) {
    if (!event.openDedupeKey) {
      existingOpenDedupeKeys.add(
        infraspawnAlarmOpenDedupeKey(input.sourceId, event.objectId, event.kind),
      );
    }
  }

  const pendingActivations: OpenInfraspawnAlarmInsert[] = [];
  const pendingClears: Array<{
    eventIds: string[];
    clearedAt: Date;
    valueAtClear: number | null;
  }> = [];

  for (const row of uniqueRows.values()) {
    const previous = previousByObjectId.get(row.objectId);
    const prevState = extractPointAlarmStateFromRawMetadata(
      previous?.rawMetadata ?? null,
    );
    const nextState = extractPointAlarmStateFromRow(row);
    const { activated: activatedKinds, cleared: clearedKinds } = diffAlarmKinds(
      prevState,
      nextState,
    );
    const sampleTime = row.sampledAt;

    for (const kind of activatedKinds) {
      const dedupeKey = infraspawnAlarmOpenDedupeKey(
        input.sourceId,
        row.objectId,
        kind,
      );
      if (existingOpenDedupeKeys.has(dedupeKey)) {
        continue;
      }

      pendingActivations.push({
        sourceId: input.sourceId,
        objectId: row.objectId,
        buildingId: input.buildingId,
        kind,
        severity: inferInfraspawnAlarmSeverity({
          objectId: row.objectId,
          objectName: row.objectName,
          description: row.description,
          unit: row.unit,
          kind,
        }),
        alarmText: alarmTextForRow(row),
        valueAtActivation: row.valueNum ?? null,
        activatedAt: sampleTime,
        domain: inferInfraspawnSystemDomain({
          objectId: row.objectId,
          objectName: row.objectName,
          description: row.description,
          unit: row.unit,
        }),
        metadata: {
          unit: row.unit ?? null,
          quality: row.quality ?? null,
        },
      });
      existingOpenDedupeKeys.add(dedupeKey);
    }

    for (const kind of clearedKinds) {
      const openForKind = takeOpenAlarmsForKind(
        index,
        row.objectId,
        kind as InfraspawnAlarmKind,
      );
      if (openForKind.length === 0) continue;

      pendingClears.push({
        eventIds: openForKind.map((event) => event.id),
        clearedAt: new Date(
          Math.max(
            sampleTime.getTime(),
            ...openForKind.map((event) => event.activatedAt.getTime()),
          ),
        ),
        valueAtClear: row.valueNum ?? null,
      });
    }
  }

  const [activated, cleared] = await Promise.all([
    openAlarmsIfAbsent(pendingActivations, { existingOpenDedupeKeys }),
    closeOpenAlarmEvents(pendingClears),
  ]);

  return { activated, cleared };
}
