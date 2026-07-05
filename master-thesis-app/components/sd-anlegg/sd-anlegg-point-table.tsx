"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import {
  type DomainPointListFilterId,
  countPointsForDomainListFilter,
  labelForDomainPointListFilter,
  toDomainPointListFilterState,
} from "@/lib/infraspawn/domain-point-list-filters";
import type { SchemaTemplate } from "@/lib/sd-anlegg/schema-templates/types";
import {
  resolveProcessSlotLabelForPoint,
} from "@/lib/sd-anlegg/ahu-equipment-identification";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatInfraspawnPointLabel,
  formatInfraspawnPointValue,
  formatInfraspawnSyncTime,
} from "@/lib/infraspawn/display-format";
import { formatInfraspawnPointTechnicalRef } from "@/lib/infraspawn/point-display-labels";
import { resolveInfraspawnPointDisplayStatus } from "@/lib/infraspawn/point-status";
import { cn } from "@/lib/utils";
import { resolveSdAnleggPointLocationLabel } from "@/lib/sd-anlegg/resolve-point-location-label";
import { SdAnleggPointLocationEditor } from "./sd-anlegg-point-location-editor";
import {
  useSdAnleggCanEditProfile,
  useSdAnleggSiteProfile,
} from "./sd-anlegg-site-profile-context";
import { useSdAnleggEffectiveIdentification } from "./use-sd-anlegg-effective-identification";
import { useSdAnleggPointTableState } from "./use-sd-anlegg-point-table-state";
import { resolveEffectiveSubCentral } from "@/lib/sd-anlegg/point-metadata-overrides";
import { SD_ANLEGG_MAX_CHART_SERIES } from "./sd-anlegg-chart-data";
import { sdAnleggPointKey } from "./sd-anlegg-point-key";
import {
  SD_ANLEGG_BTN_PRESS,
  SD_ANLEGG_FILTER_ACTIVE,
  SD_ANLEGG_FILTER_BTN,
  SD_ANLEGG_FILTER_IDLE,
  SD_ANLEGG_ROW_ESTIMATE_PX,
  SD_ANLEGG_ROW_INTERACTIVE,
  SD_ANLEGG_ROW_SELECTED,
  SD_ANLEGG_STATUS_FAULT_BADGE,
  SD_ANLEGG_VIRTUALIZE_THRESHOLD,
} from "@/components/sd-anlegg/sd-anlegg-ui";

type Props = {
  buildingSlug: string;
  points: InfraspawnPointListItem[];
  domain?: InfraspawnSystemDomain;
  schemaTemplate?: SchemaTemplate | null;
  elementKey?: string | null;
  search: string;
  onSearchChangeAction: (value: string) => void;
  category: DomainPointListFilterId;
  onCategoryChangeAction: (category: DomainPointListFilterId) => void;
  selectedKeys: string[];
  onToggleAction: (point: InfraspawnPointListItem) => void;
  onSetSelectedKeysAction: (keys: string[]) => void;
  maxSelected?: number;
};

type RowProps = {
  buildingSlug: string;
  point: InfraspawnPointListItem;
  allPoints: readonly InfraspawnPointListItem[];
  showLocationColumn: boolean;
  processSlotLabel?: string | null;
  selected: boolean;
  disabled: boolean;
  onToggleAction: (point: InfraspawnPointListItem) => void;
};

function pointStatusBadge(point: InfraspawnPointListItem) {
  const status = resolveInfraspawnPointDisplayStatus(point);
  if (status === "alarm") {
    return (
      <Badge variant="destructive" className="font-normal">
        Alarm
      </Badge>
    );
  }
  if (status === "fault") {
    return (
      <Badge variant="outline" className={SD_ANLEGG_STATUS_FAULT_BADGE}>
        Feil
      </Badge>
    );
  }
  if (status === "out_of_service") {
    return (
      <Badge variant="secondary" className="font-normal">
        Ute av drift
      </Badge>
    );
  }
  return null;
}

function SdAnleggPointTableRow({
  buildingSlug,
  point,
  allPoints,
  showLocationColumn,
  processSlotLabel,
  selected,
  disabled,
  onToggleAction,
}: RowProps) {
  const profile = useSdAnleggSiteProfile();
  const canEditProfile = useSdAnleggCanEditProfile();
  const statusBadge = pointStatusBadge(point);
  const technicalRef = formatInfraspawnPointTechnicalRef(point);
  const locationLabel =
    profile != null
      ? resolveSdAnleggPointLocationLabel({
          sourceId: point.sourceId,
          objectId: point.objectId,
          profile,
          point,
          relatedPoints: allPoints,
        })
      : null;
  const subCentral =
    profile != null
      ? resolveEffectiveSubCentral(point, profile.pointMetadataOverrides)
      : null;

  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      className={cn(
        SD_ANLEGG_ROW_INTERACTIVE,
        selected && SD_ANLEGG_ROW_SELECTED,
        disabled && "cursor-not-allowed opacity-50",
      )}
      onClick={() => {
        if (!disabled || selected) onToggleAction(point);
      }}
    >
      <TableCell>
        <Checkbox
          checked={selected}
          disabled={disabled}
          aria-label={`Vis ${formatInfraspawnPointLabel(point)} i graf`}
          onCheckedChange={() => onToggleAction(point)}
          onClick={(e) => e.stopPropagation()}
        />
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium leading-tight">
              {formatInfraspawnPointLabel(point)}
            </p>
            {statusBadge}
          </div>
          {technicalRef ? (
            <p className="font-mono text-xs text-muted-foreground">
              {technicalRef}
            </p>
          ) : null}
          {subCentral ? (
            <p className="text-xs text-muted-foreground">
              Undersentral: {subCentral}
            </p>
          ) : null}
        </div>
      </TableCell>
      {showLocationColumn ? (
        <TableCell className="hidden lg:table-cell">
          <div className="flex flex-col gap-1">
            {processSlotLabel ? (
              <Badge variant="outline" className="w-fit font-mono text-[10px]">
                {processSlotLabel}
              </Badge>
            ) : null}
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "truncate text-sm",
                  locationLabel ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {locationLabel ?? "—"}
              </span>
              {canEditProfile && profile ? (
                <SdAnleggPointLocationEditor
                  buildingSlug={buildingSlug}
                  sourceId={point.sourceId}
                  objectId={point.objectId}
                  profile={profile}
                  canEdit={canEditProfile}
                  point={point}
                  relatedPoints={allPoints}
                />
              ) : null}
            </div>
          </div>
        </TableCell>
      ) : null}
      <TableCell className="text-right tabular-nums font-medium">
        {formatInfraspawnPointValue(point.lastValue, point.unit, point)}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge variant="outline" className="font-normal">
          {point.sourceLabel}
        </Badge>
      </TableCell>
      <TableCell className="hidden text-right text-sm text-muted-foreground sm:table-cell">
        {formatInfraspawnSyncTime(point.lastSampledAt)}
      </TableCell>
    </TableRow>
  );
}

export function SdAnleggPointTable({
  buildingSlug,
  points,
  domain,
  schemaTemplate,
  elementKey,
  search,
  onSearchChangeAction,
  category,
  onCategoryChangeAction,
  selectedKeys,
  onToggleAction,
  onSetSelectedKeysAction,
  maxSelected = SD_ANLEGG_MAX_CHART_SERIES,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const profile = useSdAnleggSiteProfile();
  const canEditProfile = useSdAnleggCanEditProfile();
  const { schemaSlotOverrides } = useSdAnleggEffectiveIdentification();
  const {
    selectedSet,
    showLocationColumn,
    tableColSpan,
    ahuPresentationModel,
    visibleCategories,
    activeCategory,
    templateClassification,
    filtered,
    sectionedRows,
    filteredKeys,
    allFilteredSelected,
    someFilteredSelected,
    atMax,
  } = useSdAnleggPointTableState({
    points,
    domain,
    schemaTemplate,
    elementKey,
    search,
    category,
    selectedKeys,
    maxSelected,
    profile,
    canEditProfile,
    schemaSlotOverrides,
  });

  const useVirtualization = filtered.length >= SD_ANLEGG_VIRTUALIZE_THRESHOLD;

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual er ikke memoizerbar
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => SD_ANLEGG_ROW_ESTIMATE_PX,
    overscan: 10,
  });

  function toggleAllFiltered() {
    if (allFilteredSelected) {
      const remove = new Set(filteredKeys);
      onSetSelectedKeysAction(selectedKeys.filter((k) => !remove.has(k)));
      return;
    }
    const next = new Set(selectedKeys);
    for (const key of filteredKeys) {
      if (next.size >= maxSelected) break;
      next.add(key);
    }
    onSetSelectedKeysAction(Array.from(next));
  }

  function renderRow(point: InfraspawnPointListItem) {
    const key = sdAnleggPointKey(point);
    const selected = selectedSet.has(key);
    const disabled = !selected && atMax;
    const processSlotLabel =
      ahuPresentationModel != null
        ? resolveProcessSlotLabelForPoint(point, ahuPresentationModel)
        : null;
    return (
      <SdAnleggPointTableRow
        key={key}
        buildingSlug={buildingSlug}
        point={point}
        allPoints={points}
        showLocationColumn={showLocationColumn}
        processSlotLabel={processSlotLabel}
        selected={selected}
        disabled={disabled}
        onToggleAction={onToggleAction}
      />
    );
  }

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 snap-x snap-mandatory scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {visibleCategories.map((item) => {
          const count = countPointsForDomainListFilter(
            points,
            domain,
            item,
            schemaTemplate,
            elementKey,
            templateClassification ?? undefined,
          );
          const label = labelForDomainPointListFilter(
            toDomainPointListFilterState(domain, item, schemaTemplate),
          );
          return (
            <button
              key={item}
              type="button"
              onClick={() => onCategoryChangeAction(item)}
              className={cn(
                SD_ANLEGG_FILTER_BTN,
                SD_ANLEGG_BTN_PRESS,
                "shrink-0 snap-start",
                activeCategory === item
                  ? SD_ANLEGG_FILTER_ACTIVE
                  : SD_ANLEGG_FILTER_IDLE,
              )}
            >
              {item === "all" ? label : `${label} (${count})`}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => onSearchChangeAction(e.target.value)}
            placeholder="Søk i signaler …"
            aria-label="Søk i signaler"
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {selectedKeys.length} av {maxSelected} valgt i graf
        </p>
      </div>
      <div
        ref={scrollRef}
        className="max-h-[min(28rem,50vh)] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-background"
      >
        <Table scrollable={false}>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_hsl(var(--border)/0.6)]">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    allFilteredSelected
                      ? true
                      : someFilteredSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={toggleAllFiltered}
                  disabled={filtered.length === 0}
                  aria-label="Velg alle synlige signaler"
                  onClick={(e) => e.stopPropagation()}
                />
              </TableHead>
              <TableHead>Signal</TableHead>
              {showLocationColumn ? (
                <TableHead className="hidden lg:table-cell">Plassering</TableHead>
              ) : null}
              <TableHead className="text-right">Verdi</TableHead>
              <TableHead className="hidden md:table-cell">Kilde</TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                Sist oppdatert
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={tableColSpan}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {points.length === 0
                    ? "Ingen signaler ennå. Sjekk at anlegget er koblet til under Integrasjoner."
                    : "Ingen treff på søket eller filteret."}
                </TableCell>
              </TableRow>
            ) : sectionedRows ? (
              sectionedRows.flatMap((section) => [
                <TableRow
                  key={`section-${section.group}`}
                  className="bg-muted/35 hover:bg-muted/35 dark:bg-muted/20"
                >
                  <TableCell colSpan={5} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">
                        {section.label}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {section.points.length}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>,
                ...section.points.map((point) => renderRow(point)),
              ])
            ) : useVirtualization ? (
              <>
                {virtualRows.length > 0 ? (
                  <TableRow aria-hidden className="hover:bg-transparent">
                    <TableCell
                      colSpan={tableColSpan}
                      className="p-0"
                      style={{ height: virtualRows[0]!.start }}
                    />
                  </TableRow>
                ) : null}
                {virtualRows.map((virtualRow) => {
                  const point = filtered[virtualRow.index];
                  if (!point) return null;
                  return renderRow(point);
                })}
                {virtualRows.length > 0 ? (
                  <TableRow aria-hidden className="hover:bg-transparent">
                    <TableCell
                      colSpan={tableColSpan}
                      className="p-0"
                      style={{
                        height:
                          rowVirtualizer.getTotalSize() -
                          virtualRows[virtualRows.length - 1]!.end,
                      }}
                    />
                  </TableRow>
                ) : null}
              </>
            ) : (
              filtered.map((point) => renderRow(point))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
