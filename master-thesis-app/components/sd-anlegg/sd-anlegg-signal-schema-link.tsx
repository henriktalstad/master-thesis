"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { resolveSignalDeepLink } from "@/lib/sd-anlegg/resolve-signal-deep-link";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  sourceId: string;
  objectId: string;
  points: readonly InfraspawnPointListItem[];
  className?: string;
  onClickAction?: (event: React.MouseEvent) => void;
};

export function SdAnleggSignalSchemaLink({
  buildingSlug,
  sourceId,
  objectId,
  points,
  className,
  onClickAction,
}: Props) {
  if (points.length === 0) return null;

  const sources = [
    ...new Map(
      points.map((point) => [point.sourceId, point.sourceLabel] as const),
    ).entries(),
  ].map(([id, label]) => ({ id, label }));

  const deepLink = resolveSignalDeepLink({
    buildingSlug,
    sourceId,
    objectId,
    points,
    sources,
    view: "schema",
  });

  if (!deepLink) return null;

  return (
    <Link
      href={deepLink.href}
      prefetch
      scroll={false}
      onClick={onClickAction}
      className={cn(
        SD_ANLEGG_BTN_PRESS,
        "inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline",
        className,
      )}
    >
      <LayoutDashboard className="size-3.5" aria-hidden />
      Åpne i skjema
    </Link>
  );
}
