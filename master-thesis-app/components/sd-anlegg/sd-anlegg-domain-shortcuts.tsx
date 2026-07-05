"use client";

import Link from "next/link";
import { ChevronRight, Flame, Wind } from "lucide-react";
import type { InfraspawnBuildingPageData } from "@/lib/infraspawn/types";
import { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import { useSdAnleggPoints } from "@/queries/infraspawn";
import { resolveSdAnleggDomainHref } from "@/lib/sd-anlegg/resolve-domain-anleggsenheter";
import { SdAnleggOverviewWidget } from "./sd-anlegg-overview-widget";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  pageData: InfraspawnBuildingPageData;
  compact?: boolean;
};

const domains = [
  {
    id: InfraspawnSystemDomain.VENTILATION,
    label: "Ventilasjon",
    description: "Luftkvalitet, VAV og avtrekk",
    icon: Wind,
  },
  {
    id: InfraspawnSystemDomain.HEATING,
    label: "Varme",
    description: "Temperaturer og varmesystem",
    icon: Flame,
  },
] as const;

export function SdAnleggDomainShortcuts({
  buildingSlug,
  pageData,
  compact = false,
}: Props) {
  const { data: points } = useSdAnleggPoints(buildingSlug, {
    staleTime: 30_000,
  });

  return (
    <SdAnleggOverviewWidget
      title="Gå til system"
      titleId="sd-anlegg-domains-title"
      subtitle={compact ? undefined : "Utforsk signaler etter fagområde"}
    >
      <ul className={cn("mt-3 space-y-1.5", compact && "mt-2 space-y-1")}>
        {domains.map((domain) => {
          const Icon = domain.icon;
          const href = resolveSdAnleggDomainHref(
            buildingSlug,
            domain.id,
            points,
            pageData.sources,
          );
          return (
            <li key={domain.id}>
              <Link
                href={href}
                prefetch
                scroll={false}
                className={cn(
                  "group flex min-h-10 items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm transition-[border-color,background-color] duration-150 ease-out",
                  "[@media(hover:hover)_and_(pointer:fine)]:hover:border-primary/30 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/50",
                  SD_ANLEGG_BTN_PRESS,
                )}
              >
                <Icon
                  className="size-4 shrink-0 text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-foreground"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">
                    {domain.label}
                  </span>
                  {!compact ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {domain.description}
                    </span>
                  ) : null}
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground opacity-70 transition-opacity duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </SdAnleggOverviewWidget>
  );
}
