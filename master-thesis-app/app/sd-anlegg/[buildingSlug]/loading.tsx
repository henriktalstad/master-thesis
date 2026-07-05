import { PageShell } from "@/components/dashboard/page-shell";
import { RouteSegmentLoading } from "@/components/ui/route-segment-loading";
import { LAST } from "@/lib/plattform-loading-labels";

export default function SdAnleggBuildingLoading() {
  return (
    <PageShell maxWidth="responsive" contentClassName="pb-8 sm:pb-10">
      <RouteSegmentLoading subtle label={LAST.sdAnlegg} />
    </PageShell>
  );
}
