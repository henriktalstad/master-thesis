import {
  INFRASPAWN_SYSTEM_DOMAIN_LABELS,
  InfraspawnSystemDomain,
} from "@/lib/infraspawn/system-domain";
import {
  isThermalSystemElementKey,
  isVentilationSystemElementKey,
} from "@/lib/infraspawn/tfm-element-keys";

export function resolveSdAnleggDomainEmptyDescription(input: {
  domain: InfraspawnSystemDomain;
  domainLabel: string;
  unitKey?: string | null;
  unitDisplayName?: string | null;
}): string {
  const unitName = input.unitDisplayName?.trim();
  const unitKey = input.unitKey?.replace(/[.\s]/g, "") ?? "";

  if (
    input.domain === InfraspawnSystemDomain.VENTILATION &&
    isThermalSystemElementKey(unitKey)
  ) {
    return unitName
      ? `${unitName} er et varmeanlegg. Se fanen ${INFRASPAWN_SYSTEM_DOMAIN_LABELS.HEATING} for disse signalene.`
      : `Dette anlegget er et varmeanlegg. Se fanen ${INFRASPAWN_SYSTEM_DOMAIN_LABELS.HEATING}.`;
  }

  if (
    input.domain === InfraspawnSystemDomain.HEATING &&
    isVentilationSystemElementKey(unitKey)
  ) {
    return unitName
      ? `${unitName} er et ventilasjonsanlegg. Se fanen ${INFRASPAWN_SYSTEM_DOMAIN_LABELS.VENTILATION}.`
      : `Dette anlegget er et ventilasjonsanlegg. Se fanen ${INFRASPAWN_SYSTEM_DOMAIN_LABELS.VENTILATION}.`;
  }

  return "Det finnes ingen punkter klassifisert under dette domenet for valgt anlegg.";
}
