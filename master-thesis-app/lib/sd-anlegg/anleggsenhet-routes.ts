export type SdAnleggNavSegment =
  | "oversikt"
  | "ventilasjon"
  | "varme"
  | "annet"
  | "styring"
  | "alarmer";

export type SdAnleggDomainSegment = "ventilasjon" | "varme" | "annet";

export type ParsedSdAnleggPath = {
  segment: SdAnleggNavSegment;
  domain?: SdAnleggDomainSegment;
  unitSlug?: string;
};

const DOMAIN_PATH_PATTERN =
  /^\/sd-anlegg\/[^/]+\/(ventilasjon|varme|annet)(?:\/([^/]+))?\/?$/;

export function sdAnleggDomainHref(
  buildingSlug: string,
  domain: SdAnleggDomainSegment,
  unitSlug?: string,
): string {
  const base = `/sd-anlegg/${buildingSlug}/${domain}`;
  return unitSlug ? `${base}/${unitSlug}` : base;
}

export function parseSdAnleggPathname(pathname: string): ParsedSdAnleggPath {
  if (pathname.endsWith("/alarmer")) {
    return { segment: "alarmer" };
  }

  if (pathname.endsWith("/styring")) {
    return { segment: "styring" };
  }

  const domainMatch = DOMAIN_PATH_PATTERN.exec(pathname);
  if (domainMatch) {
    const domain = domainMatch[1] as SdAnleggDomainSegment;
    const unitSlug = domainMatch[2];
    return {
      segment: domain,
      domain,
      unitSlug,
    };
  }

  const buildingMatch = /^\/sd-anlegg\/[^/]+\/?$/.exec(pathname);
  if (buildingMatch) {
    return { segment: "oversikt" };
  }

  return { segment: "oversikt" };
}

export function resolveSdAnleggNavSegment(pathname: string): SdAnleggNavSegment {
  return parseSdAnleggPathname(pathname).segment;
}

export function isSdAnleggDomainPath(pathname: string): boolean {
  return parseSdAnleggPathname(pathname).domain != null;
}

export function sdAnleggHrefForBuildingSwitch(
  pathname: string,
  nextBuildingSlug: string,
): string {
  const parsed = parseSdAnleggPathname(pathname);

  if (parsed.segment === "alarmer") {
    return `/sd-anlegg/${nextBuildingSlug}/alarmer`;
  }

  if (parsed.segment === "styring") {
    return `/sd-anlegg/${nextBuildingSlug}/styring`;
  }

  if (parsed.domain) {
    return sdAnleggDomainHref(nextBuildingSlug, parsed.domain);
  }

  return `/sd-anlegg/${nextBuildingSlug}`;
}
