import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  infraspawnObjectPrefix,
  infraspawnPointHaystack,
} from "@/lib/infraspawn/point-haystack";

export type InfraspawnBinarySignalInput = Pick<
  InfraspawnPointListItem,
  "objectId" | "objectName" | "description" | "unit"
>;

type StatusInput = InfraspawnBinarySignalInput &
  Pick<
    InfraspawnPointListItem,
    | "lastValue"
    | "quality"
    | "statusFault"
    | "statusInAlarm"
    | "statusOutOfService"
  >;

export function isInfraspawnBinarySignal(
  point: InfraspawnBinarySignalInput,
): boolean {
  const prefix = infraspawnObjectPrefix(point.objectId);
  if (prefix === "BV" || prefix === "BI" || prefix === "BO") return true;

  const unit = point.unit?.toLowerCase() ?? "";
  if (unit === "boolean" || unit === "no-units") {
    return /alarm|brann|smoke|fire|status|feil|fault|pumpe|pump|ventil|valve|pjeld|spjeld|damper|vifte|fan|start|drift/i.test(
      infraspawnPointHaystack(point),
    );
  }

  return false;
}

export function isInfraspawnActiveFaultPoint(point: StatusInput): boolean {
  if (point.statusOutOfService) return false;
  const quality = point.quality?.toLowerCase();
  return point.statusFault || quality === "fault";
}

export function isInfraspawnActiveAlarmPoint(point: StatusInput): boolean {
  if (point.statusOutOfService) return false;

  const quality = point.quality?.toLowerCase();
  const flagged = point.statusInAlarm || quality === "alarm";
  if (!flagged) return false;

  if (
    isInfraspawnBinarySignal(point) &&
    point.lastValue === 0 &&
    quality !== "alarm"
  ) {
    return false;
  }

  return true;
}

export type InfraspawnPointDisplayStatus =
  | "alarm"
  | "fault"
  | "out_of_service"
  | null;

export function resolveInfraspawnPointDisplayStatus(
  point: StatusInput,
): InfraspawnPointDisplayStatus {
  if (point.statusOutOfService) return "out_of_service";
  if (isInfraspawnActiveAlarmPoint(point)) return "alarm";
  if (isInfraspawnActiveFaultPoint(point)) return "fault";
  return null;
}
