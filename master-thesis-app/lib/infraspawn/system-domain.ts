import { InfraspawnSystemDomain } from "@/generated/client/enums";
import { infraspawnPointHaystack } from "@/lib/infraspawn/point-haystack";
import { parseInfraspawnPointIdentity } from "@/lib/infraspawn/parse-infraspawn-point-identity";

export { InfraspawnSystemDomain };

export const INFRASPAWN_SYSTEM_DOMAIN_LABELS: Record<
  InfraspawnSystemDomain,
  string
> = {
  [InfraspawnSystemDomain.VENTILATION]: "Ventilasjon",
  [InfraspawnSystemDomain.HEATING]: "Varme",
  [InfraspawnSystemDomain.SYSTEM]: "System",
  [InfraspawnSystemDomain.OTHER]: "Annet",
};

export const INFRASPAWN_SYSTEM_DOMAINS: InfraspawnSystemDomain[] = [
  InfraspawnSystemDomain.VENTILATION,
  InfraspawnSystemDomain.HEATING,
  InfraspawnSystemDomain.OTHER,
  InfraspawnSystemDomain.SYSTEM,
];

type DomainInput = {
  objectId: string;
  objectName?: string | null;
  description?: string | null;
  unit?: string | null;
  sourceLabel?: string;
};

export function inferInfraspawnSystemDomain(
  point: DomainInput,
): InfraspawnSystemDomain {
  const haystackInput = {
    objectId: point.objectId,
    objectName: point.objectName ?? null,
    description: point.description ?? null,
    unit: point.unit ?? null,
  };
  const haystack = infraspawnPointHaystack(haystackInput).toLowerCase();
  const identity = parseInfraspawnPointIdentity({
    objectName: haystackInput.objectName,
    description: haystackInput.description,
    sourceLabel: point.sourceLabel ?? "",
  });

  if (
    /brann|brannsentral|smoke|fire|sumalarm|frostvakt|systemstatus|system.?status/.test(
      haystack,
    )
  ) {
    return InfraspawnSystemDomain.SYSTEM;
  }

  if (
    identity?.systemCode.startsWith("310") ||
    identity?.elementKey.startsWith("310")
  ) {
    return InfraspawnSystemDomain.HEATING;
  }

  if (identity?.systemCode.startsWith("320")) {
    return InfraspawnSystemDomain.HEATING;
  }

  if (identity?.systemCode.startsWith("360")) {
    return InfraspawnSystemDomain.VENTILATION;
  }

  if (identity?.subsystemRole) {
    const role = identity.subsystemRole;
    if (
      role === "supply_air" ||
      role === "extract_air" ||
      role === "intake" ||
      role === "special_extract"
    ) {
      return InfraspawnSystemDomain.VENTILATION;
    }
    if (role === "supply_water" || role === "return_water") {
      return InfraspawnSystemDomain.HEATING;
    }
  }

  if (
    /ventil|ventilation|tilluft|avtrekk|ahu|jv\d|ka\d|qd\d|lx\d|filter/.test(
      haystack,
    )
  ) {
    return InfraspawnSystemDomain.VENTILATION;
  }

  if (
    /SAF(?:Flow|Pressure|Start)?|SupplyAir|EAF(?:Flow|Pressure|Start)?|ExtractAir|FilterGuard|IntakeAir|Frostprot/i.test(
      haystack,
    )
  ) {
    return InfraspawnSystemDomain.VENTILATION;
  }

  if (
    /\b(frostrisk|sfp|airunitautomode|supplysetpoint|supplypid_setp|unitmode)\b/i.test(
      haystack,
    )
  ) {
    return InfraspawnSystemDomain.VENTILATION;
  }

  if (/differansetrykk/.test(haystack) && !identity?.systemCode.startsWith("360")) {
    return InfraspawnSystemDomain.VENTILATION;
  }

  if (
    /varme|heating|hvac|turtemp|returtemp|turvann|returvann|jp\d|sb\d|varmesentral|fjernvarme|gulvvarme|oe00\d|\brt\d{3}\b|\brp\d{3}\b|\blv\d{3}\b/.test(
      haystack,
    )
  ) {
    return InfraspawnSystemDomain.HEATING;
  }

  return InfraspawnSystemDomain.OTHER;
}

export function pointMatchesInfraspawnSystemDomain(
  point: DomainInput,
  domain: InfraspawnSystemDomain,
): boolean {
  return inferInfraspawnSystemDomain(point) === domain;
}

export function systemDomainFromPathSegment(
  segment: string,
): InfraspawnSystemDomain | null {
  switch (segment) {
    case "ventilasjon":
      return InfraspawnSystemDomain.VENTILATION;
    case "varme":
      return InfraspawnSystemDomain.HEATING;
    case "annet":
      return InfraspawnSystemDomain.OTHER;
    case "system":
      return InfraspawnSystemDomain.SYSTEM;
    default:
      return null;
  }
}

export function systemDomainToPathSegment(
  domain: InfraspawnSystemDomain,
): string {
  switch (domain) {
    case InfraspawnSystemDomain.VENTILATION:
      return "ventilasjon";
    case InfraspawnSystemDomain.HEATING:
      return "varme";
    case InfraspawnSystemDomain.SYSTEM:
      return "system";
    case InfraspawnSystemDomain.OTHER:
      return "annet";
  }
}
