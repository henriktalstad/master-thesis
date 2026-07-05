"use client";

import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { sdAnleggDomainHref } from "@/lib/sd-anlegg/anleggsenhet-routes";
import type { SdAnleggDomainSegment } from "@/lib/sd-anlegg/anleggsenhet-routes";
import type { SdAnleggsenhet } from "@/lib/sd-anlegg/infer-anleggsenheter";
import { SD_ANLEGG_UNGROUPED_UNIT_KEY } from "@/lib/sd-anlegg/infer-anleggsenheter";
import type { SdDomainAnleggsenhet } from "@/lib/sd-anlegg/resolve-domain-anleggsenheter";
import { resolveAnleggsenhetDisplayName } from "@/lib/sd-anlegg/anleggsenhet-display-overrides";
import type { ResolvedSdAnleggSiteProfile } from "@/lib/sd-anlegg/site-profile-schema";
import { cn } from "@/lib/utils";
import {
  SD_ANLEGG_BTN_PRESS,
  SD_ANLEGG_CARD,
  SD_ANLEGG_OVERVIEW_WIDGET_BODY,
} from "@/components/sd-anlegg/sd-anlegg-ui";

type Props = {
  buildingSlug: string;
  domainSegment: SdAnleggDomainSegment;
  domainLabel: string;
  units: readonly SdDomainAnleggsenhet[];
  profile?: ResolvedSdAnleggSiteProfile;
};

const confidenceLabel = {
  high: "Auto-detektert",
  medium: "Delvis detektert",
  low: "Ugruppert",
} as const;

function resolveDetectionLabel(unit: SdAnleggsenhet): string {
  if (unit.unitKey === SD_ANLEGG_UNGROUPED_UNIT_KEY) {
    return confidenceLabel.low;
  }
  switch (unit.detectionMethod) {
    case "prefix":
    case "source":
      return confidenceLabel.high;
    case "equipment_band":
      return "Utstyrsbånd";
    case "bacnet_role":
      return "BACnet-rolle";
    case "ungrouped":
      return confidenceLabel.low;
    default:
      return confidenceLabel[unit.detectionConfidence];
  }
}

export function SdAnleggUnitPicker({
  buildingSlug,
  domainSegment,
  domainLabel,
  units,
  profile,
}: Props) {
  if (units.length === 0) {
    return (
      <section className={cn(SD_ANLEGG_CARD, "overflow-hidden")}>
        <div className={SD_ANLEGG_OVERVIEW_WIDGET_BODY}>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Ingen anlegg i {domainLabel.toLowerCase()}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Det finnes ingen signaler klassifisert under {domainLabel.toLowerCase()}{" "}
            for dette bygget.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={cn(SD_ANLEGG_CARD, "overflow-hidden")} aria-labelledby="sd-unit-picker-title">
      <div className={SD_ANLEGG_OVERVIEW_WIDGET_BODY}>
        <div className="space-y-1">
          <h2
            id="sd-unit-picker-title"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Velg anlegg
          </h2>
          <p className="text-sm text-muted-foreground">
            {units.length === 1
              ? `${domainLabel} har én detektert enhet. Velg den for skjema og signaler.`
              : `${domainLabel} er delt på ${units.length} enheter. Tallet viser antall signaler i ${domainLabel.toLowerCase()}. Velg hvilket anlegg du vil jobbe med.`}
          </p>
        </div>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {units.map((entry) => {
            const href = sdAnleggDomainHref(
              buildingSlug,
              domainSegment,
              entry.unit.slug,
            );

            return (
              <li key={entry.unit.id}>
                <Link
                  href={href}
                  prefetch
                  scroll={false}
                  className={cn(
                    "group flex min-h-[88px] flex-col justify-between rounded-xl border border-border bg-muted/20 p-4 transition-[border-color,background-color,box-shadow] duration-150 ease-out",
                    "[@media(hover:hover)_and_(pointer:fine)]:hover:border-primary/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/40 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-sm",
                    SD_ANLEGG_BTN_PRESS,
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground">
                      <Building2 className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug text-foreground">
                        {resolveAnleggsenhetDisplayName(
                          entry.unit.id,
                          entry.unit.displayName,
                          profile?.anleggsenhetDisplayOverrides ?? [],
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {entry.domainPoints.length}{" "}
                        {entry.domainPoints.length === 1 ? "signal" : "signaler"}{" "}
                        i {domainLabel.toLowerCase()}
                        {entry.domainPoints.length === 0
                          ? ` · ${entry.unit.pointCount} totalt i kilden`
                          : ""}
                      </p>
                    </div>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground opacity-70 transition-opacity duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100"
                      aria-hidden
                    />
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {resolveDetectionLabel(entry.unit)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
