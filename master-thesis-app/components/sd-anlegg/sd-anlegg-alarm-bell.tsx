"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import type { InfraspawnAlarmSummary } from "@/lib/infraspawn/alarm-event-types";
import { formatInfraspawnAlarmTimestamp } from "@/lib/infraspawn/display-format";
import { resolveAlarmDisplayForEvent } from "@/lib/infraspawn/resolve-alarm-display-for-event";
import { useSdAnleggEffectivePointMapping } from "./use-sd-anlegg-effective-point-mapping";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSdAnleggOpenAlarm } from "./sd-anlegg-alarm-modal";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";
import { useIsClientMounted } from "@/hooks/use-is-client-mounted";
import { useSdAnleggAlarmSummary } from "@/queries/infraspawn";

type Props = {
  buildingSlug: string;
  summary: InfraspawnAlarmSummary | undefined;
  className?: string;
};

export function SdAnleggAlarmBell({ buildingSlug, summary, className }: Props) {
  const { openAlarmAction } = useSdAnleggOpenAlarm();
  const { featuredPointRefs, pointDisplayOverrides, livePoints } =
    useSdAnleggEffectivePointMapping(buildingSlug);

  const activeCount = summary?.activeCount ?? 0;
  const latest = summary?.latestActive;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("relative gap-2", SD_ANLEGG_BTN_PRESS, className)}
        >
          <Bell className="size-4" />
          <span className="hidden sm:inline">Alarmer</span>
          {activeCount > 0 ? (
            <Badge className="ml-0.5 min-w-5 justify-center border-amber-600/40 bg-amber-500 px-1.5 text-white hover:bg-amber-500">
              {activeCount > 99 ? "99+" : activeCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <p className="text-sm font-medium text-foreground">Aktive alarmer</p>
        {activeCount === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Ingen aktive alarmer akkurat nå.
          </p>
        ) : latest ? (
          <button
            type="button"
            className={cn(
              "mt-3 w-full rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-left text-sm",
              SD_ANLEGG_BTN_PRESS,
              "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/40",
            )}
            onClick={() =>
              openAlarmAction(latest.sourceId, latest.objectId)
            }
          >
            <p className="font-medium text-foreground">
              {resolveAlarmDisplayForEvent(latest, {
                featuredPointRefs,
                pointDisplayOverrides,
                livePoints,
              }).primaryTitle}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatInfraspawnAlarmTimestamp(latest.activatedAt)}
            </p>
          </button>
        ) : null}
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="outline" size="sm" className={SD_ANLEGG_BTN_PRESS} asChild>
            <Link href={`/sd-anlegg/${buildingSlug}/alarmer`} prefetch scroll={false}>
              Åpne alarmlogg
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type LiveBellProps = {
  buildingSlug: string;
  poll?: boolean;
  enabled?: boolean;
  className?: string;
};

function SdAnleggAlarmBellLive({
  buildingSlug,
  poll,
  className,
}: LiveBellProps & { poll: boolean }) {
  const { data: summary } = useSdAnleggAlarmSummary(buildingSlug, { poll });

  return (
    <SdAnleggAlarmBell
      buildingSlug={buildingSlug}
      summary={summary}
      className={className}
    />
  );
}

export function SdAnleggAlarmBellWithQuery({
  buildingSlug,
  poll = true,
  enabled = true,
  className,
}: LiveBellProps) {
  const mounted = useIsClientMounted();

  if (!enabled || !mounted) {
    return (
      <SdAnleggAlarmBell
        buildingSlug={buildingSlug}
        summary={undefined}
        className={className}
      />
    );
  }

  return (
    <SdAnleggAlarmBellLive
      buildingSlug={buildingSlug}
      poll={poll}
      className={className}
    />
  );
}
