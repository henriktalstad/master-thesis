"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DomainPointListFilterId } from "@/lib/infraspawn/domain-point-list-filters";
import type { SdAnleggChartRangeHours } from "@/lib/infraspawn/sd-anlegg-chart-policy";
import type { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SchemaTemplate } from "@/lib/sd-anlegg/schema-templates/types";
import type { SdAnleggChartSeries } from "./sd-anlegg-chart-data";
import { SdAnleggPointsCard } from "./sd-anlegg-points-card";
import { SdAnleggSignalOnboardingBanner } from "./sd-anlegg-signal-onboarding-banner";
import {
  isAhuProcessSchemaTemplate,
  isSdAnleggProcessSchemaTemplate,
} from "@/lib/sd-anlegg/schema-template-ids";
import { SdAnleggSchemaContextStrip } from "./sd-anlegg-schema-context-strip";
import { SdAnleggSchemaView } from "./sd-anlegg-schema-view";
import {
  SD_ANLEGG_WORKSPACE_TABS_LIST,
  SD_ANLEGG_WORKSPACE_TABS_TRIGGER,
} from "@/components/sd-anlegg/sd-anlegg-ui";

export type SdAnleggWorkspaceView = "schema" | "list";

type Props = {
  view: SdAnleggWorkspaceView;
  onViewChangeAction: (view: SdAnleggWorkspaceView) => void;
  canEditLayout: boolean;
  buildingSlug: string;
  points: InfraspawnPointListItem[];
  domain?: InfraspawnSystemDomain;
  schemaTemplate?: SchemaTemplate | null;
  elementKey?: string | null;
  unitDisplayName?: string;
  scopeId?: string;
  selectedKeys: string[];
  onSelectPointsAction: (points: InfraspawnPointListItem[]) => void;
  search: string;
  onSearchChangeAction: (value: string) => void;
  category: DomainPointListFilterId;
  onCategoryChangeAction: (value: DomainPointListFilterId) => void;
  onToggleAction: (point: InfraspawnPointListItem) => void;
  onSetSelectedKeysAction: (keys: string[]) => void;
  selectedPoints: InfraspawnPointListItem[];
  chartSeries: SdAnleggChartSeries[];
  dataCoverage: string | null;
  chartHours: number;
  chartRangeOptions: ReadonlyArray<{ hours: SdAnleggChartRangeHours; label: string }>;
  onChartHoursChangeAction: (hours: SdAnleggChartRangeHours) => void;
  seriesLoading: boolean;
  seriesError: Error | null;
  seriesFetching: boolean;
};

export function SdAnleggWorkspaceTabs({
  view,
  onViewChangeAction,
  canEditLayout,
  buildingSlug,
  points,
  domain,
  schemaTemplate,
  elementKey,
  unitDisplayName,
  scopeId,
  selectedKeys,
  onSelectPointsAction,
  search,
  onSearchChangeAction,
  category,
  onCategoryChangeAction,
  onToggleAction,
  onSetSelectedKeysAction,
  selectedPoints,
  chartSeries,
  dataCoverage,
  chartHours,
  chartRangeOptions,
  onChartHoursChangeAction,
  seriesLoading,
  seriesError,
  seriesFetching,
}: Props) {
  const isAhuProcessSchema = isAhuProcessSchemaTemplate(schemaTemplate?.id);
  const showProcessSchema =
    isSdAnleggProcessSchemaTemplate(schemaTemplate?.id) && points.length > 0;

  const schemaViewProps = {
    buildingSlug,
    points,
    schemaTemplateId: schemaTemplate?.id,
    elementKey,
    selectedKeys,
    onSelectPointsAction,
    unitDisplayName,
    selectedPoints,
    chartSeries,
    dataCoverage,
    chartHours,
    chartRangeOptions,
    onChartHoursChangeAction,
    seriesLoading,
    seriesError,
    seriesFetching,
  };

  return (
    <Tabs
      value={view}
      onValueChange={(value) =>
        onViewChangeAction(value as SdAnleggWorkspaceView)
      }
      className="space-y-4"
    >
      {isAhuProcessSchema && points.length > 0 && view === "list" ? (
        <SdAnleggSignalOnboardingBanner
          buildingSlug={buildingSlug}
          points={points}
          elementKey={elementKey}
          domainUnits={
            scopeId && unitDisplayName
              ? [{ scopeId, displayName: unitDisplayName }]
              : []
          }
          canEdit={canEditLayout}
        />
      ) : null}
      <TabsList className={SD_ANLEGG_WORKSPACE_TABS_LIST}>
        <TabsTrigger value="schema" className={SD_ANLEGG_WORKSPACE_TABS_TRIGGER}>
          Skjema
        </TabsTrigger>
        <TabsTrigger value="list" className={SD_ANLEGG_WORKSPACE_TABS_TRIGGER}>
          Liste
        </TabsTrigger>
      </TabsList>

      <TabsContent value="schema" className="space-y-4">
        {showProcessSchema ? (
          <>
            <SdAnleggSchemaContextStrip
              buildingSlug={buildingSlug}
              schemaTemplateId={schemaTemplate?.id}
              points={points}
            />
            <SdAnleggSchemaView {...schemaViewProps} />
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Prosess-skjema er ikke tilgjengelig for dette anlegget.
            </p>
            <p className="mt-2">
              Bruk fanen Liste for å se og analysere signaler.
            </p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="list">
        <SdAnleggPointsCard
          buildingSlug={buildingSlug}
          points={points}
          domain={domain}
          schemaTemplate={schemaTemplate}
          elementKey={elementKey}
          search={search}
          onSearchChangeAction={onSearchChangeAction}
          category={category}
          onCategoryChangeAction={onCategoryChangeAction}
          selectedKeys={selectedKeys}
          onToggleAction={onToggleAction}
          onSetSelectedKeysAction={onSetSelectedKeysAction}
        />
      </TabsContent>
    </Tabs>
  );
}
