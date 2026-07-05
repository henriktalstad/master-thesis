"use client";

import { Badge } from "@/components/ui/badge";
import {
  formatInfraspawnAlarmTimestamp,
  formatInfraspawnPointValue,
} from "@/lib/infraspawn/display-format";
import {
  formatAlarmCycleDuration,
  resolveAlarmGroupDisplayCycle,
  type InfraspawnAlarmPointGroup,
} from "@/lib/infraspawn/group-alarm-events";
import { INFRASPAWN_ALARM_SEVERITY_LABELS } from "@/lib/infraspawn/alarm-severity";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { cn } from "@/lib/utils";
import { useSdAnleggOpenAlarm } from "./sd-anlegg-alarm-modal";
import { SdAnleggPointLocationEditor } from "./sd-anlegg-point-location-editor";
import { SdAnleggSignalSchemaLink } from "./sd-anlegg-signal-schema-link";
import {
  useSdAnleggCanEditProfile,
  useSdAnleggSiteProfile,
} from "./sd-anlegg-site-profile-context";
import {
  SD_ANLEGG_ALARM_GROUP_CARD,
  SD_ANLEGG_ALARM_SEVERITY_ACCENT,
  SD_ANLEGG_ALARM_SEVERITY_BADGE,
  SD_ANLEGG_BTN_PRESS,
} from "@/components/sd-anlegg/sd-anlegg-ui";

type Props = {
  buildingSlug: string;
  group: InfraspawnAlarmPointGroup;
  livePoints?: InfraspawnPointListItem[];
  muted?: boolean;
};

export function SdAnleggAlarmGroupRow({
  buildingSlug,
  group,
  livePoints,
  muted = false,
}: Props) {
  const { openAlarmAction } = useSdAnleggOpenAlarm();
  const profile = useSdAnleggSiteProfile();
  const canEditProfile = useSdAnleggCanEditProfile();
  const displayCycle = resolveAlarmGroupDisplayCycle(group);
  const isActive = group.activeEvent != null;
  const pointMeta = livePoints?.find(
    (point) =>
      point.sourceId === group.sourceId && point.objectId === group.objectId,
  );

  return (
    <li
      className={cn(
        SD_ANLEGG_ALARM_GROUP_CARD,
        "relative overflow-hidden border-l-[3px]",
        SD_ANLEGG_ALARM_SEVERITY_ACCENT[group.severity],
        isActive && !muted && "bg-amber-50/50 dark:bg-amber-950/15",
        muted && "opacity-80",
      )}
    >
      {canEditProfile && profile ? (
        <div className="absolute right-3 top-3 z-10">
          <SdAnleggPointLocationEditor
            buildingSlug={buildingSlug}
            sourceId={group.sourceId}
            objectId={group.objectId}
            profile={profile}
            canEdit={canEditProfile}
            point={pointMeta ?? null}
            relatedPoints={livePoints}
            signalHint={group.signalLabel}
            equipmentRef={group.equipmentRef}
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => openAlarmAction(group.sourceId, group.objectId)}
        className={cn(
          "w-full p-4 text-left",
          SD_ANLEGG_BTN_PRESS,
          "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/30",
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2 pr-10">
          <Badge
            className={cn(
              "h-5 px-1.5 text-[10px] font-semibold",
              SD_ANLEGG_ALARM_SEVERITY_BADGE[group.severity],
            )}
          >
            {INFRASPAWN_ALARM_SEVERITY_LABELS[group.severity]}
          </Badge>
          <span
            className={cn(
              "font-medium",
              muted ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {group.primaryTitle}
          </span>
          {isActive ? (
            <Badge
              variant="outline"
              className="border-amber-600/35 bg-amber-100/90 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
            >
              Pågår
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              Avsluttet
            </Badge>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{group.secondaryLine}</span>
          <span aria-hidden>·</span>
          <span>
            {formatInfraspawnAlarmTimestamp(displayCycle.activatedAt)}
          </span>
          <span aria-hidden>·</span>
          <span>
            {formatAlarmCycleDuration(
              displayCycle.activatedAt,
              displayCycle.clearedAt,
            )}
          </span>
          <span aria-hidden>·</span>
          <span>
            {formatInfraspawnPointValue(
              displayCycle.valueAtActivation,
              group.unit,
            )}
          </span>
          {group.cycleCount > 1 ? (
            <>
              <span aria-hidden>·</span>
              <span>{group.cycleCount} utløsninger</span>
            </>
          ) : null}
        </div>
      </button>
      {livePoints && livePoints.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-2">
          <SdAnleggSignalSchemaLink
            buildingSlug={buildingSlug}
            sourceId={group.sourceId}
            objectId={group.objectId}
            points={livePoints}
          />
        </div>
      ) : null}
    </li>
  );
}
