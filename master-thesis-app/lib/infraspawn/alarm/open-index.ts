import type { InfraspawnAlarmKind } from "@/generated/client/enums";
import {
  infraspawnAlarmObjectKindKey,
} from "@/lib/infraspawn/alarm/dedupe-key";
import type { OpenAlarmRecord } from "@/lib/infraspawn/alarm/types";

export type OpenAlarmIndex = {
  openByObjectKind: Map<string, OpenAlarmRecord[]>;
  dedupeKeys: Set<string>;
};

export function buildOpenAlarmIndex(
  events: readonly OpenAlarmRecord[],
): OpenAlarmIndex {
  const openByObjectKind = new Map<string, OpenAlarmRecord[]>();
  const dedupeKeys = new Set<string>();

  for (const event of events) {
    if (event.openDedupeKey) {
      dedupeKeys.add(event.openDedupeKey);
    }
    const key = infraspawnAlarmObjectKindKey(event.objectId, event.kind);
    const bucket = openByObjectKind.get(key) ?? [];
    bucket.push(event);
    openByObjectKind.set(key, bucket);
  }

  return { openByObjectKind, dedupeKeys };
}

export function takeOpenAlarmsForKind(
  index: OpenAlarmIndex,
  objectId: string,
  kind: InfraspawnAlarmKind,
): OpenAlarmRecord[] {
  const key = infraspawnAlarmObjectKindKey(objectId, kind);
  const openForKind = index.openByObjectKind.get(key) ?? [];
  if (openForKind.length === 0) return [];

  index.openByObjectKind.delete(key);
  for (const event of openForKind) {
    if (event.openDedupeKey) {
      index.dedupeKeys.delete(event.openDedupeKey);
    }
  }

  return openForKind;
}
