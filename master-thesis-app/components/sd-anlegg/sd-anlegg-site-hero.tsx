"use client";

import Image from "next/image";
import { Building2, Radio } from "lucide-react";
import type { ResolvedSdAnleggSiteProfile } from "@/lib/sd-anlegg/site-profile-schema";
import { SdAnleggSiteContact } from "./sd-anlegg-site-contact";
import { SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  profile: ResolvedSdAnleggSiteProfile;
  buildingSlug: string;
  anleggsnavnLine?: string | null;
  canEdit?: boolean;
};

export function SdAnleggSiteHero({
  profile,
  buildingSlug,
  anleggsnavnLine,
  canEdit = false,
}: Props) {
  const showContact = Boolean(
    canEdit ||
      profile.contactName?.trim() ||
      profile.contactPhone?.trim() ||
      profile.contactEmail?.trim(),
  );
  const title = profile.displayTitle ?? profile.buildingName;

  return (
    <aside className={cn(SD_ANLEGG_CARD, "overflow-hidden rounded-xl")}>
      <div className="relative aspect-[16/10] w-full bg-muted sm:aspect-[5/3]">
        {profile.heroImageUrl ? (
          <Image
            src={profile.heroImageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 320px"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Building2 className="size-10 opacity-50" aria-hidden />
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {profile.clientLogoUrl ? (
            <div className="relative h-9 w-32 pt-0.5">
              <Image
                src={profile.clientLogoUrl}
                alt=""
                fill
                className="object-contain object-left"
                sizes="128px"
              />
            </div>
          ) : profile.contactLabel ? (
            <p className="text-sm text-muted-foreground">{profile.contactLabel}</p>
          ) : null}
        </div>

        {anleggsnavnLine ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Radio className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 leading-snug">{anleggsnavnLine}</span>
          </p>
        ) : null}

        {showContact ? (
          <SdAnleggSiteContact
            buildingSlug={buildingSlug}
            profile={profile}
            canEdit={canEdit}
          />
        ) : null}
      </div>
    </aside>
  );
}
