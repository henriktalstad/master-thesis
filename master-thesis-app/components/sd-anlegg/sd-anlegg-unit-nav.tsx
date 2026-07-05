"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { LayoutGrid } from "lucide-react";
import {
  sdAnleggDomainHref,
  type SdAnleggDomainSegment,
} from "@/lib/sd-anlegg/anleggsenhet-routes";
import { resolveAnleggsenhetDisplayName } from "@/lib/sd-anlegg/anleggsenhet-display-overrides";
import type { SdDomainAnleggsenhet } from "@/lib/sd-anlegg/resolve-domain-anleggsenheter";
import type { ResolvedSdAnleggSiteProfile } from "@/lib/sd-anlegg/site-profile-schema";
import { cn } from "@/lib/utils";
import { SD_ANLEGG_BTN_PRESS, SD_ANLEGG_UNIT_PILL } from "@/components/sd-anlegg/sd-anlegg-ui";

type Props = {
  buildingSlug: string;
  domainSegment: SdAnleggDomainSegment;
  units: readonly SdDomainAnleggsenhet[];
  activeUnitSlug?: string;
  profile: ResolvedSdAnleggSiteProfile | null;
  showPickerLink?: boolean;
};

export function SdAnleggUnitNav({
  buildingSlug,
  domainSegment,
  units,
  activeUnitSlug,
  profile,
  showPickerLink = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const softNavigate = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  const resolvedActive =
    activeUnitSlug ??
    units.find((entry) => pathname.endsWith(`/${entry.unit.slug}`))?.unit.slug;

  return (
    <div
      className={cn(
        "inline-flex w-fit max-w-full flex-col gap-2 rounded-xl border border-border/80 bg-muted/25 p-2 sm:p-2.5",
        "motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-out",
        isPending && "pointer-events-none opacity-70",
      )}
      aria-label="Anleggsenheter"
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Anlegg
        </p>
        {showPickerLink ? (
          <Link
            href={sdAnleggDomainHref(buildingSlug, domainSegment)}
            prefetch
            className={cn(
              "inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary",
              SD_ANLEGG_BTN_PRESS,
            )}
          >
            <LayoutGrid className="size-3" aria-hidden />
            Alle anlegg
          </Link>
        ) : null}
      </div>

      <div
        className={cn(
          "flex max-w-full flex-wrap gap-1.5",
          units.length > 3 &&
            "flex-nowrap overflow-x-auto scroll-smooth pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {units.map((entry) => {
          const href = sdAnleggDomainHref(
            buildingSlug,
            domainSegment,
            entry.unit.slug,
          );
          const isActive = resolvedActive === entry.unit.slug;
          const displayName = resolveAnleggsenhetDisplayName(
            entry.unit.id,
            entry.unit.displayName,
            profile?.anleggsenhetDisplayOverrides ?? [],
          );

          return (
            <Link
              key={entry.unit.id}
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
                SD_ANLEGG_UNIT_PILL,
                SD_ANLEGG_BTN_PRESS,
                isActive
                  ? "border-primary/50 bg-background text-foreground shadow-sm"
                  : "border-transparent bg-transparent text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:border-border [@media(hover:hover)_and_(pointer:fine)]:hover:bg-background/70 [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
              title={displayName}
            >
              <span>{displayName}</span>
              <span
                className={cn(
                  "inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-muted/80 text-muted-foreground",
                )}
              >
                {entry.domainPoints.length}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
