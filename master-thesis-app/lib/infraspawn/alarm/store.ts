import "server-only";

import type { InfraspawnAlarmKind } from "@/generated/client/enums";
import { prisma, withPrismaRetry } from "@/lib/db";
import { infraspawnAlarmOpenDedupeKey } from "@/lib/infraspawn/alarm/dedupe-key";
import type {
  CloseAlarmBatch,
  OpenAlarmRecord,
  OpenInfraspawnAlarmInsert,
} from "@/lib/infraspawn/alarm/types";
import {
  extractPointAlarmStateFromRawMetadata,
  isAlarmKindActiveInState,
} from "@/lib/infraspawn/point-alarm-state";

const OPEN_ALARM_SELECT = {
  id: true,
  objectId: true,
  kind: true,
  activatedAt: true,
  openDedupeKey: true,
} as const;

export async function loadOpenAlarmsForObjects(input: {
  sourceId: string;
  objectIds: string[];
}): Promise<OpenAlarmRecord[]> {
  if (input.objectIds.length === 0) return [];

  return prisma.infraspawnAlarmEvent.findMany({
    where: {
      sourceId: input.sourceId,
      objectId: { in: input.objectIds },
      clearedAt: null,
    },
    select: OPEN_ALARM_SELECT,
  });
}

export async function openAlarmsIfAbsent(
  inputs: readonly OpenInfraspawnAlarmInsert[],
  options?: { existingOpenDedupeKeys?: ReadonlySet<string> },
): Promise<number> {
  if (inputs.length === 0) return 0;

  const blocked = new Set(options?.existingOpenDedupeKeys ?? []);
  const pending: Array<{
    input: OpenInfraspawnAlarmInsert;
    openDedupeKey: string;
  }> = [];

  for (const input of inputs) {
    const openDedupeKey = infraspawnAlarmOpenDedupeKey(
      input.sourceId,
      input.objectId,
      input.kind,
    );
    if (blocked.has(openDedupeKey)) continue;
    blocked.add(openDedupeKey);
    pending.push({ input, openDedupeKey });
  }

  if (pending.length === 0) return 0;

  const existing = await prisma.infraspawnAlarmEvent.findMany({
    where: { openDedupeKey: { in: pending.map((row) => row.openDedupeKey) } },
    select: { openDedupeKey: true },
  });
  const existingInDb = new Set(
    existing
      .map((row) => row.openDedupeKey)
      .filter((key): key is string => key != null),
  );

  const toInsert = pending.filter((row) => !existingInDb.has(row.openDedupeKey));
  if (toInsert.length === 0) return 0;

  const result = await withPrismaRetry(() =>
    prisma.infraspawnAlarmEvent.createMany({
      data: toInsert.map(({ input, openDedupeKey }) => ({
        sourceId: input.sourceId,
        objectId: input.objectId,
        buildingId: input.buildingId,
        kind: input.kind,
        severity: input.severity,
        alarmText: input.alarmText,
        valueAtActivation: input.valueAtActivation,
        activatedAt: input.activatedAt,
        domain: input.domain,
        openDedupeKey,
        metadata: input.metadata ?? {},
      })),
    }),
  );

  return result.count;
}

export async function openAlarmIfAbsent(
  input: OpenInfraspawnAlarmInsert,
  options?: { existingOpenDedupeKeys?: ReadonlySet<string> },
): Promise<boolean> {
  const count = await openAlarmsIfAbsent([input], options);
  return count > 0;
}

export async function closeOpenAlarmEvents(
  batches: readonly CloseAlarmBatch[],
): Promise<number> {
  let cleared = 0;
  for (const batch of batches) {
    if (batch.eventIds.length === 0) continue;
    const updated = await withPrismaRetry(() =>
      prisma.infraspawnAlarmEvent.updateMany({
        where: {
          id: { in: batch.eventIds },
          clearedAt: null,
        },
        data: {
          clearedAt: batch.clearedAt,
          valueAtClear: batch.valueAtClear,
          openDedupeKey: null,
        },
      }),
    );
    cleared += updated.count;
  }
  return cleared;
}

/** Lukker åpne alarmer når punkt-meta viser at kind ikke lenger er aktiv. */
export async function reconcileStaleOpenAlarms(input: {
  sourceId: string;
  clearedAt?: Date;
}): Promise<number> {
  const openEvents = await prisma.infraspawnAlarmEvent.findMany({
    where: { sourceId: input.sourceId, clearedAt: null },
    select: {
      id: true,
      objectId: true,
      kind: true,
    },
  });
  if (openEvents.length === 0) return 0;

  const objectIds = [...new Set(openEvents.map((event) => event.objectId))];
  const metaRows = await prisma.infraspawnBacnetPointMeta.findMany({
    where: {
      sourceId: input.sourceId,
      objectId: { in: objectIds },
    },
    select: { objectId: true, rawMetadata: true },
  });

  const stateByObjectId = new Map(
    metaRows.map((row) => [
      row.objectId,
      extractPointAlarmStateFromRawMetadata(row.rawMetadata),
    ]),
  );

  const clearedAt = input.clearedAt ?? new Date();
  const idsToClear: string[] = [];

  for (const event of openEvents) {
    const state = stateByObjectId.get(event.objectId) ?? {
      alarm: false,
      fault: false,
      outOfService: false,
    };
    if (!isAlarmKindActiveInState(state, event.kind as InfraspawnAlarmKind)) {
      idsToClear.push(event.id);
    }
  }

  if (idsToClear.length === 0) return 0;

  const updated = await withPrismaRetry(() =>
    prisma.infraspawnAlarmEvent.updateMany({
      where: {
        id: { in: idsToClear },
        clearedAt: null,
      },
      data: {
        clearedAt,
        openDedupeKey: null,
      },
    }),
  );

  return updated.count;
}
