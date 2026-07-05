import { Suspense } from "react";
import { SdAnleggOverviewPanel } from "@/components/sd-anlegg/sd-anlegg-overview-panel";
import { SdAnleggOverviewControlStatusSkeleton } from "@/components/sd-anlegg/sd-anlegg-overview-control-status-skeleton";
import { SdAnleggOverviewControlStatusSlot } from "@/components/sd-anlegg/sd-anlegg-overview-control-status-slot";
import { awaitSdAnleggPageParams } from "@/lib/sd-anlegg/await-page-params";
import { loadSdAnleggBuildingShellData } from "@/lib/sd-anlegg/load-building-page";

type Props = {
  params: Promise<{ buildingSlug: string }>;
};

export default async function SdAnleggBuildingOverviewPage({ params }: Props) {
  const { buildingSlug } = await awaitSdAnleggPageParams(params);
  const { pageData, profile, canEditProfile } =
    await loadSdAnleggBuildingShellData(buildingSlug);

  return (
    <SdAnleggOverviewPanel
      pageData={pageData}
      profile={profile}
      canEditProfile={canEditProfile}
      controlOpsSlot={
        <Suspense fallback={<SdAnleggOverviewControlStatusSkeleton />}>
          <SdAnleggOverviewControlStatusSlot buildingSlug={buildingSlug} />
        </Suspense>
      }
    />
  );
}
