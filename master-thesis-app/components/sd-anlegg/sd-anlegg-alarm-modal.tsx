"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { findAlarmGroupByKey } from "@/lib/infraspawn/alarm-overview";
import { useSdAnleggAlarmGroups, useSdAnleggPoints } from "@/queries/infraspawn";
import type { SdAnleggFeaturedPointRef } from "@/lib/sd-anlegg/site-profile-schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Skeleton } from "@/components/ui/skeleton";
import { SdAnleggAlarmDetail } from "./sd-anlegg-alarm-detail";
import { SdAnleggSignalSchemaLink } from "./sd-anlegg-signal-schema-link";
import { useSdAnleggAlarmModal } from "./use-sd-anlegg-alarm-modal";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type OpenAlarmAction = (sourceId: string, objectId: string) => void;

const SdAnleggAlarmModalContext = createContext<OpenAlarmAction | null>(null);

export function useSdAnleggOpenAlarm() {
  const openAlarmAction = use(SdAnleggAlarmModalContext);
  if (!openAlarmAction) {
    throw new Error("useSdAnleggOpenAlarm må brukes innenfor SdAnleggAlarmModalHost");
  }
  return { openAlarmAction };
}

const EMPTY_POINT_REFS: readonly SdAnleggFeaturedPointRef[] = [];

type HostProps = {
  buildingSlug: string;
  featuredPointRefs?: readonly SdAnleggFeaturedPointRef[];
  pointDisplayOverrides?: readonly SdAnleggFeaturedPointRef[];
  children: ReactNode;
};

export function SdAnleggAlarmModalHost({
  buildingSlug,
  featuredPointRefs = EMPTY_POINT_REFS,
  pointDisplayOverrides = EMPTY_POINT_REFS,
  children,
}: HostProps) {
  const { alarmKey, isOpen, openAlarmAction, closeAlarmAction } =
    useSdAnleggAlarmModal();

  return (
    <SdAnleggAlarmModalContext.Provider value={openAlarmAction}>
      {children}
      <SdAnleggAlarmModal
        buildingSlug={buildingSlug}
        alarmKey={alarmKey}
        isOpen={isOpen}
        featuredPointRefs={featuredPointRefs}
        pointDisplayOverrides={pointDisplayOverrides}
        onCloseAction={closeAlarmAction}
      />
    </SdAnleggAlarmModalContext.Provider>
  );
}

function AlarmModalSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="flex items-start gap-3">
        <Skeleton className="size-8 shrink-0 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-14 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-lg" />
    </div>
  );
}

function SdAnleggAlarmModal({
  buildingSlug,
  alarmKey,
  isOpen,
  featuredPointRefs,
  pointDisplayOverrides,
  onCloseAction,
}: {
  buildingSlug: string;
  alarmKey: string | null;
  isOpen: boolean;
  featuredPointRefs: readonly SdAnleggFeaturedPointRef[];
  pointDisplayOverrides: readonly SdAnleggFeaturedPointRef[];
  onCloseAction: () => void;
}) {
  const { data, isPending, isError, isFetching } = useSdAnleggAlarmGroups(
    buildingSlug,
    isOpen && alarmKey != null,
    featuredPointRefs,
    pointDisplayOverrides,
  );

  const group =
    alarmKey && data ? findAlarmGroupByKey(data.allGroups, alarmKey) : null;
  const showSkeleton = isPending || (isFetching && group == null);

  const { data: points = [] } = useSdAnleggPoints(buildingSlug);

  const livePoint = useMemo(() => {
    if (!group) return null;
    return (
      points.find(
        (point) =>
          point.sourceId === group.sourceId &&
          point.objectId === group.objectId,
      ) ?? null
    );
  }, [group, points]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCloseAction()}>
      <DialogContent className="flex max-h-[min(92vh,52rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="border-b border-border/70 px-4 py-4 sm:px-6">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle>
              {group?.modalTitle ?? "Alarmdetaljer"}
            </DialogTitle>
            <DialogDescription>
              Verdi ved alarm, nåverdi, varighet og syklushistorikk for valgt signal.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {showSkeleton ? (
            <AlarmModalSkeleton />
          ) : isError ? (
            <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-3 text-sm text-destructive">
              Kunne ikke laste alarmdetaljer.
            </p>
          ) : group ? (
            <SdAnleggAlarmDetail
              buildingSlug={buildingSlug}
              group={group}
              livePoint={livePoint}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-4 text-sm text-muted-foreground">
              Fant ikke alarmen. Den kan være avsluttet eller utenfor loggvinduet.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border/70 bg-muted/10 px-4 py-3 sm:px-6">
          {group && points.length > 0 ? (
            <SdAnleggSignalSchemaLink
              buildingSlug={buildingSlug}
              sourceId={group.sourceId}
              objectId={group.objectId}
              points={points}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                SD_ANLEGG_BTN_PRESS,
                "gap-1.5 no-underline hover:no-underline",
              )}
            />
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(SD_ANLEGG_BTN_PRESS, "gap-1.5")}
            asChild
          >
            <Link href={`/sd-anlegg/${buildingSlug}/alarmer`} prefetch scroll={false}>
              <ExternalLink className="size-3.5" aria-hidden />
              Full alarmlogg
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            className={SD_ANLEGG_BTN_PRESS}
            onClick={onCloseAction}
          >
            Lukk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
