import type { InfraspawnAlarmEventDisplayInput } from "@/lib/infraspawn/alarm-event-display-input";
import {
  resolveAlarmDisplayContext,
  type AlarmDisplayContext,
} from "@/lib/infraspawn/resolve-alarm-display-context";
import type { SdAnleggFeaturedPointRef } from "@/lib/sd-anlegg/site-profile-schema";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export type { AlarmDisplayContext } from "@/lib/infraspawn/resolve-alarm-display-context";
export { resolveAlarmDisplayContext } from "@/lib/infraspawn/resolve-alarm-display-context";

export type ResolveAlarmDisplayInput = {
  featuredPointRefs?: readonly SdAnleggFeaturedPointRef[];
  pointDisplayOverrides?: readonly SdAnleggFeaturedPointRef[];
  livePoints?: readonly InfraspawnPointListItem[];
};

function lookupLivePoint(
  sourceId: string,
  objectId: string,
  livePoints: readonly InfraspawnPointListItem[] | undefined,
): InfraspawnPointListItem | null {
  return (
    livePoints?.find(
      (point) => point.sourceId === sourceId && point.objectId === objectId,
    ) ?? null
  );
}

export function resolveAlarmDisplayForEvent(
  event: InfraspawnAlarmEventDisplayInput,
  input: ResolveAlarmDisplayInput = {},
): AlarmDisplayContext {
  const point = lookupLivePoint(event.sourceId, event.objectId, input.livePoints);

  return resolveAlarmDisplayContext({
    sourceId: event.sourceId,
    objectId: event.objectId,
    alarmText: event.alarmText,
    sourceLabel: point?.sourceLabel ?? event.sourceLabel ?? null,
    objectName: event.objectName ?? point?.objectName ?? null,
    description: event.description ?? point?.description ?? null,
    featuredPointRefs: input.featuredPointRefs,
    pointDisplayOverrides: input.pointDisplayOverrides,
    relatedPoints: input.livePoints,
  });
}
