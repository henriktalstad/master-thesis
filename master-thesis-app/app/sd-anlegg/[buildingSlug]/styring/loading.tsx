import { RouteSegmentLoading } from "@/components/ui/route-segment-loading";
import { LAST } from "@/lib/plattform-loading-labels";

export default function SdAnleggStyringLoading() {
  return <RouteSegmentLoading subtle label={LAST.sdAnleggStyring} />;
}
