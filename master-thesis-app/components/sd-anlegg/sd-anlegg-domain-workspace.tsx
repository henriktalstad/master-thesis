"use client";

import { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import type {
  InfraspawnBuildingPageData,
  InfraspawnPointListItem,
} from "@/lib/infraspawn/types";
import type { SdAnleggsenhet } from "@/lib/sd-anlegg/infer-anleggsenheter";
import { resolveSdAnleggDomainEmptyDescription } from "@/lib/sd-anlegg/domain-unit-empty-copy";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { SdAnleggChartCard } from "./sd-anlegg-chart-card";
import { SdAnleggKpiStrip } from "./sd-anlegg-kpi-strip";
import { SdAnleggWorkspaceTabs } from "./sd-anlegg-workspace-tabs";
import { useSdAnleggBuildingWorkspace } from "./use-sd-anlegg-building-workspace";

type Props = {
  pageData: InfraspawnBuildingPageData;
  initialPoints: InfraspawnPointListItem[];
  canEditLayout?: boolean;
  domain: InfraspawnSystemDomain;
  domainLabel: string;
  activeUnit?: SdAnleggsenhet | null;
};

export function SdAnleggDomainWorkspace({
  pageData,
  initialPoints,
  canEditLayout = false,
  domain,
  domainLabel,
  activeUnit,
}: Props) {
  const workspace = useSdAnleggBuildingWorkspace({
    pageData,
    initialPoints,
    canEditLayout,
    domain,
    unitObjectIds: activeUnit?.objectIds,
    scopeId: activeUnit?.id,
    unitKey: activeUnit?.unitKey,
  });

  return (
    <div className="space-y-6">
      {domain !== InfraspawnSystemDomain.VENTILATION && workspace.kpiSlots.length > 0 ? (
        <SdAnleggKpiStrip slots={workspace.kpiSlots} />
      ) : null}

      {workspace.showPointsLoading ? (
        <div className="flex justify-center py-16">
          <Spinner variant="dots" label="Laster signaler …" />
        </div>
      ) : workspace.pointsIsError ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">
              Kunne ikke laste signaler
            </CardTitle>
            <CardDescription>
              {workspace.pointsError?.message ?? "Ukjent feil"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : workspace.points.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Ingen signaler i {domainLabel}
              {activeUnit ? ` for ${activeUnit.displayName}` : ""}
            </CardTitle>
            <CardDescription>
              {resolveSdAnleggDomainEmptyDescription({
                domain,
                domainLabel,
                unitKey: activeUnit?.unitKey,
                unitDisplayName: activeUnit?.displayName,
              })}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <SdAnleggWorkspaceTabs
            key={workspace.pointsScopeKey}
            view={workspace.view}
            onViewChangeAction={workspace.setView}
            canEditLayout={workspace.canEditLayout}
            buildingSlug={pageData.buildingSlug}
            selectedKeys={workspace.selectedKeys}
            points={workspace.points}
            domain={domain}
            schemaTemplate={workspace.schemaTemplate}
            elementKey={workspace.elementKey}
            unitDisplayName={activeUnit?.displayName}
            scopeId={activeUnit?.id}
            search={workspace.search}
            onSearchChangeAction={workspace.setSearch}
            category={workspace.category}
            onCategoryChangeAction={workspace.setCategory}
            onToggleAction={workspace.togglePoint}
            onSetSelectedKeysAction={workspace.setSelectedKeys}
            onSelectPointsAction={workspace.selectProcessSlotPoints}
            selectedPoints={workspace.selectedPoints}
            chartSeries={workspace.chartSeries}
            dataCoverage={workspace.dataCoverage}
            chartHours={workspace.chartHours}
            chartRangeOptions={workspace.chartRangeOptions}
            onChartHoursChangeAction={workspace.setChartHours}
            seriesLoading={workspace.seriesLoading}
            seriesError={workspace.seriesError}
            seriesFetching={workspace.seriesFetching}
          />
          {workspace.view === "list" ? (
            <SdAnleggChartCard
              chartTitle={workspace.chartTitle}
              selectedPoints={workspace.selectedPoints}
              chartSeries={workspace.chartSeries}
              dataCoverage={workspace.dataCoverage}
              chartHours={workspace.chartHours}
              chartRangeOptions={workspace.chartRangeOptions}
              onChartHoursChange={workspace.setChartHours}
              seriesLoading={workspace.seriesLoading}
              seriesError={workspace.seriesError}
              seriesFetching={workspace.seriesFetching}
              onTogglePoint={workspace.togglePoint}
              onClearSelected={workspace.clearSelectedPoints}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
