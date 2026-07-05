import { SdAnleggDomainWorkspace } from "@/components/sd-anlegg/sd-anlegg-domain-workspace";
import { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import { awaitSdAnleggPageParams } from "@/lib/sd-anlegg/await-page-params";
import { loadSdAnleggDomainUnitPage } from "@/lib/sd-anlegg/load-domain-page";

type Props = {
  params: Promise<{ buildingSlug: string; unitSlug: string }>;
};

export default async function SdAnleggVentilasjonUnitPage({ params }: Props) {
  const { buildingSlug, unitSlug } = await awaitSdAnleggPageParams(params);
  const context = await loadSdAnleggDomainUnitPage(
    buildingSlug,
    InfraspawnSystemDomain.VENTILATION,
    unitSlug,
  );

  return (
    <SdAnleggDomainWorkspace
      key={`${context.domainSegment}-${unitSlug}`}
      pageData={context.pageData}
      initialPoints={context.unitDomainPoints}
      canEditLayout={context.canEditLayout}
      domain={context.domain}
      domainLabel={context.domainLabel}
      activeUnit={context.activeUnit}
    />
  );
}
