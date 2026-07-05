"use client";

import type {
  ControlLoopDiagram,
  ControlPlantModel,
  MpcEvalCoverageSummary,
  MpcPipelineRunRecord,
} from "@/lib/sd-anlegg/control/control-types";
import { SdAnleggControlAlgorithmPanel } from "@/components/sd-anlegg/control/setup/algorithm-panel";
import { SdAnleggControlMpcModelPanel } from "@/components/sd-anlegg/control/setup/mpc-model-panel";
import { SdAnleggControlSystemModel } from "@/components/sd-anlegg/control/setup/system-model";
import { SdAnleggControlDataQuality } from "@/components/sd-anlegg/control/setup/data-quality";
import { SdAnleggControlMissingSignals } from "@/components/sd-anlegg/control/setup/missing-signals";
import { SdAnleggControlPlannedCommandsPanel } from "@/components/sd-anlegg/control/setup/planned-commands-panel";
import { CONTROL_SETUP_UI } from "@/lib/sd-anlegg/control/control-display-labels";
import { SdAnleggControlCollapsibleSection } from "@/components/sd-anlegg/control/shared/section";

type Props = {
  unitKey: string;
  buildingName: string;
  buildingSlug: string;
  plantModel: ControlPlantModel;
  loopDiagram: ControlLoopDiagram;
  sdSignalCoveragePct: number;
  loadedSdCanonicalCount: number;
  mpcEvalCoverage?: MpcEvalCoverageSummary | null;
  mpcPipelineRun?: MpcPipelineRunRecord | null;
  usesMpcControl?: boolean;
  liveSampledAt?: string | null;
};

export function SdAnleggControlSystemPanel({
  unitKey,
  buildingName,
  buildingSlug,
  plantModel,
  loopDiagram,
  sdSignalCoveragePct,
  loadedSdCanonicalCount,
  mpcEvalCoverage = null,
  mpcPipelineRun = null,
  usesMpcControl = false,
}: Props) {
  const replaySteps = mpcPipelineRun?.snapshot.replaySummary?.stepCount;
  const plantRmse = mpcPipelineRun?.snapshot.plantValidation?.rmseC;

  return (
    <div className="space-y-4">
      <SdAnleggControlAlgorithmPanel
        buildingSlug={buildingSlug}
        unitKey={unitKey}
        diagram={loopDiagram}
        usesMpc={usesMpcControl}
      />

      <SdAnleggControlDataQuality
        dataQuality={plantModel.dataQuality}
        sdSignalCoveragePct={sdSignalCoveragePct}
        loadedSdCanonicalCount={loadedSdCanonicalCount}
        hideSummary
      />

      {usesMpcControl && mpcPipelineRun ? (
        <SdAnleggControlCollapsibleSection
          title={CONTROL_SETUP_UI.modelQualityTitle}
          description={CONTROL_SETUP_UI.modelQualityDescription}
          badge={
            plantRmse != null
              ? `RMSE ${plantRmse} °C`
              : replaySteps != null
                ? `${replaySteps} intervaller`
                : undefined
          }
        >
          <div className="space-y-4 px-4 pb-4">
            <SdAnleggControlMpcModelPanel
              coverage={mpcEvalCoverage}
              mpcPipelineRun={mpcPipelineRun}
              compact
            />
          </div>
        </SdAnleggControlCollapsibleSection>
      ) : null}

      <SdAnleggControlCollapsibleSection
        title={CONTROL_SETUP_UI.subsystemsTitle}
        description={CONTROL_SETUP_UI.subsystemsDescription(plantModel.unitKey)}
        badge={CONTROL_SETUP_UI.subsystemsBadge(plantModel.subsystems.length)}
      >
        <div className="px-4 pb-4">
          <SdAnleggControlSystemModel plantModel={plantModel} embedded />
        </div>
      </SdAnleggControlCollapsibleSection>

      <SdAnleggControlCollapsibleSection
        title={CONTROL_SETUP_UI.plannedCommandsTitle}
        description={CONTROL_SETUP_UI.plannedCommandsDescription}
      >
        <div className="px-4 pb-4">
          <SdAnleggControlPlannedCommandsPanel buildingSlug={buildingSlug} embedded />
        </div>
      </SdAnleggControlCollapsibleSection>

      <SdAnleggControlMissingSignals buildingName={buildingName} unitKey={unitKey} />
    </div>
  );
}
