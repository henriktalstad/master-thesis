import { SdAnleggAlarmLog } from "@/components/sd-anlegg/sd-anlegg-alarm-log";
import { awaitSdAnleggPageParams } from "@/lib/sd-anlegg/await-page-params";
import { assertSdAnleggBuildingAccess } from "@/lib/sd-anlegg/assert-building-access";

type Props = {
  params: Promise<{ buildingSlug: string }>;
};

export default async function SdAnleggAlarmerPage({ params }: Props) {
  const { buildingSlug } = await awaitSdAnleggPageParams(params);
  await assertSdAnleggBuildingAccess(buildingSlug);

  return <SdAnleggAlarmLog buildingSlug={buildingSlug} />;
}
