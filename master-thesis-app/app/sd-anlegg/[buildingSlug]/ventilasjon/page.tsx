import { SdAnleggUnitPicker } from "@/components/sd-anlegg/sd-anlegg-unit-picker";
import { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import { awaitSdAnleggPageParams } from "@/lib/sd-anlegg/await-page-params";
import { loadSdAnleggDomainIndexPage } from "@/lib/sd-anlegg/load-domain-page";

type Props = {
  params: Promise<{ buildingSlug: string }>;
};

export default async function SdAnleggVentilasjonPage({ params }: Props) {
  const { buildingSlug } = await awaitSdAnleggPageParams(params);
  const context = await loadSdAnleggDomainIndexPage(
    buildingSlug,
    InfraspawnSystemDomain.VENTILATION,
  );

  return (
    <SdAnleggUnitPicker
      buildingSlug={buildingSlug}
      domainSegment={context.domainSegment}
      domainLabel={context.domainLabel}
      units={context.domainNavUnits}
      profile={context.profile}
    />
  );
}
