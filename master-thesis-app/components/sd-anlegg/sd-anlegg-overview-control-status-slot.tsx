import { loadSdAnleggControlOpsSummaryForBuilding } from "@/lib/sd-anlegg/load-building-page";
import { SdAnleggOverviewControlStatusCard } from "./sd-anlegg-overview-control-status-card";

type Props = {
  buildingSlug: string;
};

export async function SdAnleggOverviewControlStatusSlot({
  buildingSlug,
}: Props) {
  const summary = await loadSdAnleggControlOpsSummaryForBuilding(buildingSlug);
  if (!summary) return null;
  return (
    <SdAnleggOverviewControlStatusCard
      buildingSlug={buildingSlug}
      summary={summary}
    />
  );
}
