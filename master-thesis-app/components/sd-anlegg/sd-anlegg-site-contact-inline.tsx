"use client";

import type { ReactNode } from "react";
import { UserRound } from "lucide-react";
import {
  formatSdAnleggContactPhoneDisplay,
  formatSdAnleggContactTelHref,
} from "@/lib/sd-anlegg/format-contact-phone";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SD_ANLEGG_CONTACT_PHONE } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase();
}

function SdAnleggContactAvatar({
  imageUrl,
  name,
  className,
}: {
  imageUrl: string | null;
  name: string | null;
  className?: string;
}) {
  const initials = name ? contactInitials(name) : null;

  return (
    <Avatar className={cn("size-10 shrink-0 ring-1 ring-border/60", className)}>
      {imageUrl ? (
        <AvatarImage src={imageUrl} alt={name ? `Profilbilde for ${name}` : ""} />
      ) : null}
      <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
        {initials ?? <UserRound className="size-4" aria-hidden />}
      </AvatarFallback>
    </Avatar>
  );
}

export function SdAnleggContactInline({
  name,
  phone,
  email,
  imageUrl,
  orgLabel,
  actions,
}: {
  name: string | null;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  orgLabel?: string | null;
  actions?: ReactNode;
}) {
  const displayPhone = phone?.trim()
    ? formatSdAnleggContactPhoneDisplay(phone)
    : null;
  const telHref = phone?.trim() ? formatSdAnleggContactTelHref(phone) : null;
  const trimmedEmail = email?.trim() || null;

  return (
    <div className="flex items-start gap-3">
      <SdAnleggContactAvatar imageUrl={imageUrl} name={name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            {name ? (
              <p className="font-medium leading-snug text-foreground">{name}</p>
            ) : null}
            {orgLabel?.trim() ? (
              <p className="text-xs text-muted-foreground">{orgLabel.trim()}</p>
            ) : null}
            {(displayPhone || trimmedEmail) ? (
              <div className="space-y-0.5 pt-0.5 text-sm">
                {displayPhone && telHref ? (
                  <a
                    href={telHref}
                    className={cn(
                      "inline-block transition-colors duration-150 ease-out",
                      SD_ANLEGG_CONTACT_PHONE,
                      "[@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground",
                    )}
                  >
                    {displayPhone}
                  </a>
                ) : null}
                {trimmedEmail ? (
                  <a
                    href={`mailto:${trimmedEmail}`}
                    className="block break-all text-muted-foreground transition-colors duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground"
                  >
                    {trimmedEmail}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center">{actions}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
