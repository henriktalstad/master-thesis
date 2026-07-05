"use client";

import type { ControlLookbackDays } from "@/lib/sd-anlegg/control/resolve-control-lookback";
import type {
  ControlLoopDiagram,
  ControlPlantModel,
  MpcEvalCoverageSummary,
  MpcPipelineRunRecord,
} from "@/lib/sd-anlegg/control/control-types";
import type { ResolvedMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";
import { SdAnleggControlPreferencesPanel } from "@/components/sd-anlegg/control/setup/preferences-panel";
import { SdAnleggControlSystemPanel } from "@/components/sd-anlegg/control/setup/system-panel";
import { SdAnleggControlSignalCatalogPanel } from "@/components/sd-anlegg/control/setup/signal-catalog-panel";
import { SdAnleggControlSetupCoverageHero } from "@/components/sd-anlegg/control/setup/setup-coverage-hero";
import { SdAnleggControlSetupLookbackNav } from "@/components/sd-anlegg/control/setup/setup-lookback-nav";
import { SdAnleggControlSectionHeader } from "@/components/sd-anlegg/control/shared/section";
import { CONTROL_SETUP_UI } from "@/lib/sd-anlegg/control/control-display-labels";

type Props = {
  buildingSlug: string;
  lookbackDays: ControlLookbackDays;
  plantModel: ControlPlantModel;
  loopDiagram: ControlLoopDiagram;
  sdSignalCoveragePct: number;
  loadedSdCanonicalIds: readonly string[];
  mpcEvalCoverage: MpcEvalCoverageSummary | null;
  mpcPipelineRun: MpcPipelineRunRecord | null;
  usesMpcControl: boolean;
  liveSampledAt: string | null;
  mpcBuildingPreferences: ResolvedMpcBuildingPreferences;
  mpcPreferencesHasSavedOverrides: boolean;
  canSimulate: boolean;
  examinerMode?: boolean;
};

export function SdAnleggControlSetupPanel({
  buildingSlug,
  lookbackDays,
  plantModel,
  loopDiagram,
  sdSignalCoveragePct,
  loadedSdCanonicalIds,
  mpcEvalCoverage,
  mpcPipelineRun,
  usesMpcControl,
  liveSampledAt,
  mpcBuildingPreferences,
  mpcPreferencesHasSavedOverrides,
  canSimulate,
  examinerMode = false,
}: Props) {
  return (
    <div className="space-y-8">
      <section aria-label="Preferanser" className="space-y-4">
        <SdAnleggControlSectionHeader
          title={CONTROL_SETUP_UI.preferencesTitle}
          description={CONTROL_SETUP_UI.preferencesDescription}
        />
        <SdAnleggControlPreferencesPanel
          buildingSlug={buildingSlug}
          preferences={mpcBuildingPreferences}
          hasSavedOverrides={mpcPreferencesHasSavedOverrides}
          canSimulate={canSimulate}
          examinerMode={examinerMode}
        />
      </section>

      <section aria-label="Modell og dekning" className="space-y-4">
        <SdAnleggControlSectionHeader
          title={CONTROL_SETUP_UI.modelSectionTitle}
          description={CONTROL_SETUP_UI.modelSectionDescription}
        />
        <SdAnleggControlSetupLookbackNav
          buildingSlug={buildingSlug}
          lookbackDays={lookbackDays}
          activeTab="oppsett"
          examinerMode={examinerMode}
        />
        <SdAnleggControlSetupCoverageHero
          dataQuality={plantModel.dataQuality}
          sdSignalCoveragePct={sdSignalCoveragePct}
          mpcEvalCoverage={mpcEvalCoverage}
          mpcPipelineRun={mpcPipelineRun}
        />
        <SdAnleggControlSystemPanel
          unitKey={plantModel.unitKey}
          buildingName={plantModel.buildingName}
          buildingSlug={buildingSlug}
          plantModel={plantModel}
          loopDiagram={loopDiagram}
          sdSignalCoveragePct={sdSignalCoveragePct}
          loadedSdCanonicalCount={loadedSdCanonicalIds.length}
          mpcEvalCoverage={mpcEvalCoverage}
          mpcPipelineRun={mpcPipelineRun}
          usesMpcControl={usesMpcControl}
          liveSampledAt={liveSampledAt}
        />
        <SdAnleggControlSignalCatalogPanel
          plantModel={plantModel}
          evalCoverage={mpcEvalCoverage}
          defaultOpen={false}
        />
      </section>
    </div>
  );
}
