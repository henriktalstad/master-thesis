import type { InfraspawnAlarmKind } from "@/generated/client/enums";

export function infraspawnAlarmOpenDedupeKey(
  sourceId: string,
  objectId: string,
  kind: InfraspawnAlarmKind,
): string {
  return `${sourceId}:${objectId}:${kind}`;
}

export function infraspawnAlarmObjectKindKey(
  objectId: string,
  kind: InfraspawnAlarmKind,
): string {
  return `${objectId}:${kind}`;
}
