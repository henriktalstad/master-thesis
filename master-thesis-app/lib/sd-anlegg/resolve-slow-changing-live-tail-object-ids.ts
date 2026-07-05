import { isAhuProcessSettingsScopePoint } from "@/lib/sd-anlegg/ahu-process-settings";
import { isHxEfficiencyPercentSignal } from "@/lib/sd-anlegg/ahu-signal-alias-registry";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export function resolveSdAnleggSlowChangingTailObjectIds(
  points: readonly InfraspawnPointListItem[],
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const point of points) {
    if (seen.has(point.objectId)) continue;
    if (
      !isAhuProcessSettingsScopePoint(point) &&
      !isHxEfficiencyPercentSignal(point)
    ) {
      continue;
    }
    seen.add(point.objectId);
    ids.push(point.objectId);
  }

  return ids;
}
