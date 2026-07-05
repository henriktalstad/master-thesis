"use client";

import type { RefObject } from "react";
import { formatSdAnleggContactPhoneDisplay } from "@/lib/sd-anlegg/format-contact-phone";
import type { ContactDraftAction, ContactDraftState } from "@/lib/sd-anlegg/site-contact-draft-state";
import { trimContactField } from "@/lib/sd-anlegg/site-contact-draft-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SD_ANLEGG_CONTACT_PHONE } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

const PLACEHOLDERS = {
  name: "Kontaktpersonens navn",
  phone: "Mobilnummer",
  email: "E-postadresse",
} as const;

type Props = {
  draft: ContactDraftState;
  dispatch: React.Dispatch<ContactDraftAction>;
  nameInputRef: RefObject<HTMLInputElement | null>;
  isMutating: boolean;
};

export function SdAnleggSiteContactFormFields({
  draft,
  dispatch,
  nameInputRef,
  isMutating,
}: Props) {
  return (
    <div
      className={cn(
        "space-y-4 rounded-xl border border-border/80 p-4",
        isMutating && "opacity-60",
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Kontaktinfo
      </p>

      <div className="space-y-2">
        <Label htmlFor="sd-anlegg-contact-name">Navn</Label>
        <Input
          ref={nameInputRef}
          id="sd-anlegg-contact-name"
          value={draft.contactName}
          onChange={(event) =>
            dispatch({
              type: "set_field",
              field: "contactName",
              value: event.target.value,
            })
          }
          placeholder={PLACEHOLDERS.name}
          autoComplete="name"
          disabled={isMutating}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sd-anlegg-contact-phone">Mobil</Label>
        <Input
          id="sd-anlegg-contact-phone"
          value={draft.contactPhone}
          onChange={(event) =>
            dispatch({
              type: "set_field",
              field: "contactPhone",
              value: event.target.value,
            })
          }
          placeholder={PLACEHOLDERS.phone}
          autoComplete="tel"
          inputMode="tel"
          disabled={isMutating}
        />
        {trimContactField(draft.contactPhone) ? (
          <p className="text-xs text-muted-foreground">
            Vises som{" "}
            <span className={cn("text-foreground", SD_ANLEGG_CONTACT_PHONE)}>
              {formatSdAnleggContactPhoneDisplay(draft.contactPhone)}
            </span>
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="sd-anlegg-contact-email">E-post</Label>
        <Input
          id="sd-anlegg-contact-email"
          type="email"
          value={draft.contactEmail}
          onChange={(event) =>
            dispatch({
              type: "set_field",
              field: "contactEmail",
              value: event.target.value,
            })
          }
          placeholder={PLACEHOLDERS.email}
          autoComplete="email"
          disabled={isMutating}
        />
      </div>
    </div>
  );
}
