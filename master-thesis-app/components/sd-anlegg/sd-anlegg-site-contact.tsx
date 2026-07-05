"use client";

import { useState } from "react";
import { Pencil, UserRound } from "lucide-react";
import { hasContactDetails } from "@/lib/sd-anlegg/site-contact-draft-state";
import type { ResolvedSdAnleggSiteProfile } from "@/lib/sd-anlegg/site-profile-schema";
import { Button } from "@/components/ui/button";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import { SdAnleggContactInline } from "./sd-anlegg-site-contact-inline";
import { SdAnleggSiteContactDialog } from "./sd-anlegg-site-contact-dialog";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  profile: ResolvedSdAnleggSiteProfile;
  canEdit: boolean;
};

export function SdAnleggSiteContact({ buildingSlug, profile, canEdit }: Props) {
  const [open, setOpen] = useState(false);

  const hasContact = hasContactDetails({
    name: profile.contactName ?? "",
    phone: profile.contactPhone ?? "",
    email: profile.contactEmail ?? "",
  });

  if (!hasContact && !canEdit) return null;

  const contactActions = canEdit ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-8 shrink-0", SD_ANLEGG_BTN_PRESS)}
      aria-label={hasContact ? "Endre kontakt" : "Legg til kontakt"}
      onClick={() => setOpen(true)}
    >
      {hasContact ? (
        <Pencil className="size-3.5" aria-hidden />
      ) : (
        <UserRound className="size-3.5" aria-hidden />
      )}
    </Button>
  ) : null;

  return (
    <>
      {hasContact ? (
        <SdAnleggContactInline
          name={profile.contactName}
          phone={profile.contactPhone}
          email={profile.contactEmail}
          imageUrl={profile.contactImageUrl}
          orgLabel={profile.clientLogoUrl ? profile.contactLabel : null}
          actions={contactActions}
        />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Ingen kontaktperson satt</p>
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("size-8 shrink-0", SD_ANLEGG_BTN_PRESS)}
              aria-label="Legg til kontakt"
              onClick={() => setOpen(true)}
            >
              <UserRound className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      )}

      {canEdit ? (
        <SdAnleggSiteContactDialog
          buildingSlug={buildingSlug}
          profile={profile}
          open={open}
          onOpenChangeAction={setOpen}
          hasSavedContact={hasContact}
        />
      ) : null}
    </>
  );
}
