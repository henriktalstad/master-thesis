import { notFound, redirect } from "next/navigation";
import {
  INFRASPAWN_SYSTEM_DOMAIN_LABELS,
  systemDomainToPathSegment,
  InfraspawnSystemDomain,
} from "@/lib/infraspawn/system-domain";
import { sdAnleggDomainHref } from "./anleggsenhet-routes";
import type { SdAnleggDomainSegment } from "./anleggsenhet-routes";
import { loadSdAnleggBuildingShellData } from "./load-building-page";
import {
  applyPointMetadataOverridesToList,
  resolveEffectiveAnleggsenhetAssignments,
} from "./point-metadata-overrides";
import {
  SD_ANLEGG_UNGROUPED_UNIT_KEY,
} from "./infer-anleggsenheter";
import {
  findDomainAnleggsenhetBySlug,
  resolveDomainAnleggsenheter,
  type SdDomainAnleggsenhet,
} from "./resolve-domain-anleggsenheter";
import { HEATING_DISTRICT_COMBINED_UNIT_KEY } from "./heating-process-units";

export type SdAnleggDomainPageContext = Awaited<
  ReturnType<typeof loadSdAnleggBuildingShellData>
> & {
  domain: InfraspawnSystemDomain;
  domainLabel: string;
  domainSegment: SdAnleggDomainSegment;
  domainUnits: SdDomainAnleggsenhet[];
  domainNavUnits: SdDomainAnleggsenhet[];
};

async function loadDomainContext(
  buildingSlug: string,
  domain: InfraspawnSystemDomain,
): Promise<SdAnleggDomainPageContext> {
  const base = await loadSdAnleggBuildingShellData(buildingSlug);
  const effectivePoints = applyPointMetadataOverridesToList(
    base.initialPoints,
    base.profile.pointMetadataOverrides,
  );
  const effectiveAssignments = resolveEffectiveAnleggsenhetAssignments(
    base.profile.anleggsenhetPointAssignments,
    base.profile.pointMetadataOverrides,
  );
  const domainSegment = systemDomainToPathSegment(domain) as SdAnleggDomainSegment;
  const domainUnits = resolveDomainAnleggsenheter(
    effectivePoints,
    base.pageData.sources,
    domain,
    base.profile.anleggsenhetDisplayOverrides,
    effectiveAssignments,
  );

  return {
    ...base,
    initialPoints: effectivePoints,
    domain,
    domainLabel: INFRASPAWN_SYSTEM_DOMAIN_LABELS[domain],
    domainSegment,
    domainUnits,
    domainNavUnits: domainUnits,
  };
}

export async function loadSdAnleggDomainIndexPage(
  buildingSlug: string,
  domain: InfraspawnSystemDomain,
) {
  const context = await loadDomainContext(buildingSlug, domain);

  if (context.domainUnits.length === 1) {
    const only = context.domainUnits[0]!.unit;
    const skipAutoRedirect =
      only.unitKey === SD_ANLEGG_UNGROUPED_UNIT_KEY ||
      only.detectionConfidence === "low";

    if (!skipAutoRedirect) {
      redirect(
        sdAnleggDomainHref(
          buildingSlug,
          context.domainSegment,
          only.slug,
        ),
      );
    }
  } else if (context.domainUnits.length > 1) {
    const preferred =
      domain === InfraspawnSystemDomain.HEATING
        ? (context.domainUnits.find(
            (entry) => entry.unit.unitKey === HEATING_DISTRICT_COMBINED_UNIT_KEY,
          ) ??
          [...context.domainUnits].sort(
            (a, b) => b.domainPoints.length - a.domainPoints.length,
          )[0]!)
        : [...context.domainUnits].sort(
            (a, b) => b.domainPoints.length - a.domainPoints.length,
          )[0]!;
    const only = preferred.unit;
    const skipAutoRedirect =
      only.unitKey === SD_ANLEGG_UNGROUPED_UNIT_KEY ||
      only.detectionConfidence === "low";
    if (!skipAutoRedirect) {
      redirect(
        sdAnleggDomainHref(
          buildingSlug,
          context.domainSegment,
          only.slug,
        ),
      );
    }
  }

  return context;
}

export async function loadSdAnleggDomainUnitPage(
  buildingSlug: string,
  domain: InfraspawnSystemDomain,
  unitSlug: string,
) {
  const context = await loadDomainContext(buildingSlug, domain);
  const match = findDomainAnleggsenhetBySlug(context.domainUnits, unitSlug);

  if (!match) {
    notFound();
  }

  return {
    ...context,
    activeUnit: match.unit,
    unitDomainPoints: match.domainPoints,
  };
}
