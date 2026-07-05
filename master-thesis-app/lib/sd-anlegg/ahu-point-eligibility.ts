import { parseInfraspawnPointIdentity } from "@/lib/infraspawn/parse-infraspawn-point-identity";
import {
  isThermalSystemElementKey,
} from "@/lib/infraspawn/tfm-element-keys";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

function normalizePointName(point: InfraspawnPointListItem): string {
  return (point.objectName ?? point.objectId).trim().toUpperCase();
}
export function isHeatingOrTapWaterPoint(
  point: InfraspawnPointListItem,
): boolean {
  const identity = parseInfraspawnPointIdentity(point);
  const systemCode = identity?.systemCode;
  if (systemCode?.startsWith("310") || systemCode?.startsWith("320")) {
    return true;
  }
  if (identity?.elementKey && isThermalSystemElementKey(identity.elementKey)) {
    return true;
  }

  const name = normalizePointName(point);
  if (/^310\.001/.test(name) || /^310\.002/.test(name)) return true;
  if (/^320\.00[123]/.test(name)) return true;
  if (name.startsWith("320001OE")) return true;

  return false;
}

export function pointMatchesAhuElementScope(
  point: InfraspawnPointListItem,
  elementKey?: string | null,
): boolean {
  if (!elementKey) return true;
  const identity = parseInfraspawnPointIdentity(point);
  if (!identity?.elementKey) return true;
  return identity.elementKey === elementKey;
}
export function isAhuBindablePoint(
  point: InfraspawnPointListItem,
  elementKey?: string | null,
): boolean {
  if (!pointMatchesAhuElementScope(point, elementKey)) return false;
  if (isHeatingOrTapWaterPoint(point)) return false;
  return true;
}
