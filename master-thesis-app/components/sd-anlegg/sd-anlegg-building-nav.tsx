"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import { useSdAnleggPoints } from "@/queries/infraspawn";
import {
  parseSdAnleggPathname,
  type SdAnleggNavSegment,
} from "@/lib/sd-anlegg/anleggsenhet-routes";
import type { InfraspawnBuildingPageData } from "@/lib/infraspawn/types";
import {
  InfraspawnSystemDomain,
  systemDomainFromPathSegment,
} from "@/lib/infraspawn/system-domain";
import { resolveDomainAnleggsenheter, resolveSdAnleggDomainHref } from "@/lib/sd-anlegg/resolve-domain-anleggsenheter";
import { SD_ANLEGG_NAV_SHELL, SD_ANLEGG_NAV_TAB, SD_ANLEGG_NAV_TAB_ACTIVE, SD_ANLEGG_NAV_TAB_IDLE } from "@/components/sd-anlegg/sd-anlegg-ui";
import { useSdAnleggSiteProfile } from "./sd-anlegg-site-profile-context";
import { useSdAnleggEffectiveIdentification } from "./use-sd-anlegg-effective-identification";
import { SdAnleggUnitNav } from "./sd-anlegg-unit-nav";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  pageData: InfraspawnBuildingPageData;
  activeSegment?: SdAnleggNavSegment;
  canEditProfile?: boolean;
};

const tabs: {
  id: SdAnleggNavSegment;
  label: string;
  href: (slug: string) => string;
}[] = [
  { id: "oversikt", label: "Oversikt", href: (slug) => `/sd-anlegg/${slug}` },
  {
    id: "ventilasjon",
    label: "Ventilasjon",
    href: (slug) => `/sd-anlegg/${slug}/ventilasjon`,
  },
  {
    id: "varme",
    label: "Varme",
    href: (slug) => `/sd-anlegg/${slug}/varme`,
  },
  {
    id: "styring",
    label: "Styring",
    href: (slug) => `/sd-anlegg/${slug}/styring`,
  },
];

export function SdAnleggBuildingNav({
  buildingSlug,
  pageData,
  activeSegment,
  canEditProfile: _canEditProfile = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const profile = useSdAnleggSiteProfile();
  const { applyToPoints, effectiveAssignments } = useSdAnleggEffectiveIdentification();
  const [isPending, startTransition] = useTransition();
  const parsedPath = parseSdAnleggPathname(pathname);

  const softNavigate = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  const resolvedActive =
    activeSegment ?? parsedPath.segment;

  const { data: pointsForNav } = useSdAnleggPoints(buildingSlug, {
    staleTime: 30_000,
    refetchInterval: resolvedActive === "styring" ? false : undefined,
  });

  const domainUnits = useMemo(() => {
    if (!parsedPath.domain || !pointsForNav) return [];
    const domain = systemDomainFromPathSegment(parsedPath.domain);
    if (!domain || domain === InfraspawnSystemDomain.SYSTEM) return [];
    const effectivePoints = applyToPoints(pointsForNav);
    return resolveDomainAnleggsenheter(
      effectivePoints,
      pageData.sources,
      domain,
      profile?.anleggsenhetDisplayOverrides ?? [],
      effectiveAssignments,
    );
  }, [
    applyToPoints,
    effectiveAssignments,
    pageData.sources,
    parsedPath.domain,
    pointsForNav,
    profile?.anleggsenhetDisplayOverrides,
  ]);

  const domainTabHref = (tabId: SdAnleggNavSegment) => {
    if (tabId === "ventilasjon" || tabId === "varme" || tabId === "annet") {
      return resolveSdAnleggDomainHref(
        buildingSlug,
        systemDomainFromPathSegment(tabId)!,
        pointsForNav,
        pageData.sources,
      );
    }
    return tabs.find((tab) => tab.id === tabId)?.href(buildingSlug) ?? "#";
  };

  return (
    <div className="space-y-3">
      <div className={SD_ANLEGG_NAV_SHELL}>
        <div
          className={cn(
            "flex gap-0.5 overflow-x-auto scroll-smooth snap-x snap-mandatory",
            "scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            "motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-out",
            isPending && "pointer-events-none opacity-70",
          )}
          aria-busy={isPending}
        >
          {tabs.map((tab) => {
            const href = domainTabHref(tab.id);
            const isActive = resolvedActive === tab.id;

            return (
              <Link
                key={tab.id}
                href={href}
                prefetch
                scroll={false}
                onClick={(e) => {
                  if (e.defaultPrevented) return;
                  if (e.button !== 0) return;
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  if (isActive) {
                    e.preventDefault();
                    return;
                  }
                  e.preventDefault();
                  softNavigate(href);
                }}
                className={cn(
                  SD_ANLEGG_NAV_TAB,
                  isActive ? SD_ANLEGG_NAV_TAB_ACTIVE : SD_ANLEGG_NAV_TAB_IDLE,
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {parsedPath.domain && domainUnits.length >= 1 ? (
        <SdAnleggUnitNav
          buildingSlug={buildingSlug}
          domainSegment={parsedPath.domain}
          units={domainUnits}
          activeUnitSlug={parsedPath.unitSlug}
          profile={profile}
          showPickerLink={domainUnits.length > 1}
        />
      ) : null}
    </div>
  );
}
