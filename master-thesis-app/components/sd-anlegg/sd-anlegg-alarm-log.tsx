"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { partitionAlarmPointGroups } from "@/lib/infraspawn/alarm/partition-groups";
import { enrichAlarmGroupsWithDisplay } from "@/lib/infraspawn/alarm-overview";
import { groupInfraspawnAlarmEventsByPoint } from "@/lib/infraspawn/group-alarm-events";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  useSdAnleggAlarmLog,
  type SdAnleggAlarmLogViewMode,
} from "@/queries/infraspawn";
import { SdAnleggAlarmGroupRow } from "./sd-anlegg-alarm-group-row";
import { SdAnleggAlarmSeverityLanes } from "./sd-anlegg-alarm-severity-lanes";
import {
  useSdAnleggSiteProfile,
} from "./sd-anlegg-site-profile-context";
import {
  SD_ANLEGG_CARD,
  SD_ANLEGG_FILTER_ACTIVE,
  SD_ANLEGG_FILTER_BTN,
  SD_ANLEGG_FILTER_IDLE,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";
import type { InfraspawnAlarmPointGroup } from "@/lib/infraspawn/group-alarm-events";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

type Props = {
  buildingSlug: string;
};

export function SdAnleggAlarmLog({ buildingSlug }: Props) {
  const profile = useSdAnleggSiteProfile();
  const [limit, setLimit] = useState("100");
  const [viewMode, setViewMode] = useState<SdAnleggAlarmLogViewMode>("active");
  const [search, setSearch] = useState("");

  const { data, isPending, isError, error } = useSdAnleggAlarmLog(
    buildingSlug,
    { limit, viewMode, search },
  );

  const groups = useMemo(() => {
    const core = groupInfraspawnAlarmEventsByPoint(data?.events ?? []);
    return enrichAlarmGroupsWithDisplay(core, {
      featuredPointRefs: profile?.featuredPointRefs,
      pointDisplayOverrides: profile?.pointDisplayOverrides,
      livePoints: data?.livePoints,
    });
  }, [
    data?.events,
    data?.livePoints,
    profile?.featuredPointRefs,
    profile?.pointDisplayOverrides,
  ]);

  const { activeGroups, historyGroups } = useMemo(
    () => partitionAlarmPointGroups(groups),
    [groups],
  );

  const activeCount = data?.summary?.activeCount ?? activeGroups.length;
  const isEmpty =
    viewMode === "active"
      ? activeGroups.length === 0
      : activeGroups.length === 0 && historyGroups.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Alarmer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPending
              ? "Laster …"
              : activeCount === 0
                ? "Ingen aktive alarmer — anlegget er rolig."
                : `${activeCount} aktiv${activeCount === 1 ? "" : "e"} · ${groups.length} signal${groups.length === 1 ? "" : "er"} i loggen`}
          </p>
        </div>

        <AlarmLogToolbar
          viewMode={viewMode}
          activeCount={activeCount}
          limit={limit}
          search={search}
          onViewModeChange={setViewMode}
          onLimitChange={setLimit}
          onSearchChange={setSearch}
        />
      </div>

      {data?.summary ? (
        <SdAnleggAlarmSeverityLanes
          summary={data.summary}
          className="grid gap-2 sm:grid-cols-2"
        />
      ) : null}

      <div className={cn(SD_ANLEGG_CARD, "overflow-hidden rounded-xl p-4")}>
        {isPending ? (
          <div className="flex min-h-56 items-center justify-center py-10">
            <Spinner variant="dots" label="Laster alarmer …" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : "Kunne ikke laste alarmlogg"}
          </p>
        ) : isEmpty ? (
          <AlarmLogEmptyState viewMode={viewMode} />
        ) : (
          <div className="space-y-5">
            {viewMode === "active" ? (
              <AlarmGroupList
                buildingSlug={buildingSlug}
                groups={activeGroups}
                livePoints={data?.livePoints}
              />
            ) : (
              <>
                {activeGroups.length > 0 ? (
                  <AlarmLogSection
                    title="Pågår nå"
                    count={activeGroups.length}
                    buildingSlug={buildingSlug}
                    groups={activeGroups}
                    livePoints={data?.livePoints}
                  />
                ) : null}
                {historyGroups.length > 0 ? (
                  <AlarmLogSection
                    title={activeGroups.length > 0 ? "Avsluttet" : "Historikk"}
                    count={historyGroups.length}
                    buildingSlug={buildingSlug}
                    groups={historyGroups}
                    livePoints={data?.livePoints}
                    muted
                  />
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AlarmLogToolbar({
  viewMode,
  activeCount,
  limit,
  search,
  onViewModeChange,
  onLimitChange,
  onSearchChange,
}: {
  viewMode: SdAnleggAlarmLogViewMode;
  activeCount: number;
  limit: string;
  search: string;
  onViewModeChange: (mode: SdAnleggAlarmLogViewMode) => void;
  onLimitChange: (limit: string) => void;
  onSearchChange: (search: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex rounded-full border border-border/80 bg-muted/20 p-0.5">
        {(
          [
            ["active", "Aktive"],
            ["all", "Alle"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewModeChange(mode)}
            className={cn(
              SD_ANLEGG_FILTER_BTN,
              "border-0 px-3 py-1",
              viewMode === mode ? SD_ANLEGG_FILTER_ACTIVE : SD_ANLEGG_FILTER_IDLE,
            )}
          >
            {label}
            {mode === "active" && activeCount > 0 ? (
              <span className="ml-1 tabular-nums opacity-90">
                ({activeCount})
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="alarm-limit" className="sr-only">
          Antall hendelser
        </Label>
        <Select value={limit} onValueChange={onLimitChange}>
          <SelectTrigger id="alarm-limit" className="h-9 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="200">200</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="alarm-search" className="sr-only">
          Søk
        </Label>
        <Input
          id="alarm-search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Søk signal …"
          className="h-9 w-[200px]"
        />
      </div>
    </div>
  );
}

function AlarmLogEmptyState({
  viewMode,
}: {
  viewMode: SdAnleggAlarmLogViewMode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
      <CheckCircle2
        className="size-8 text-emerald-600/80 dark:text-emerald-400/80"
        aria-hidden
      />
      <p className="text-sm font-medium text-foreground">
        {viewMode === "active" ? "Ingen aktive alarmer" : "Ingen treff i loggen"}
      </p>
      <p className="max-w-sm text-xs text-muted-foreground">
        {viewMode === "active"
          ? "Avsluttede hendelser ligger under «Alle»."
          : "Prøv et annet søk eller øk antall hendelser."}
      </p>
    </div>
  );
}

function AlarmLogSection({
  title,
  count,
  buildingSlug,
  groups,
  livePoints,
  muted = false,
}: {
  title: string;
  count: number;
  buildingSlug: string;
  groups: InfraspawnAlarmPointGroup[];
  livePoints?: InfraspawnPointListItem[];
  muted?: boolean;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            muted ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {title}
        </h3>
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] tabular-nums">
          {count}
        </Badge>
      </div>
      <AlarmGroupList
        buildingSlug={buildingSlug}
        groups={groups}
        livePoints={livePoints}
        muted={muted}
      />
    </section>
  );
}

function AlarmGroupList({
  buildingSlug,
  groups,
  livePoints,
  muted = false,
}: {
  buildingSlug: string;
  groups: InfraspawnAlarmPointGroup[];
  livePoints?: InfraspawnPointListItem[];
  muted?: boolean;
}) {
  return (
    <ul className="space-y-2">
      {groups.map((group) => (
        <SdAnleggAlarmGroupRow
          key={group.key}
          buildingSlug={buildingSlug}
          group={group}
          livePoints={livePoints}
          muted={muted}
        />
      ))}
    </ul>
  );
}
