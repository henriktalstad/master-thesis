"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { resolveSchemaContextUi } from "@/lib/sd-anlegg/resolve-schema-context-ui";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  schemaTemplateId?: string | null;
  points: readonly InfraspawnPointListItem[];
  className?: string;
};

export function SdAnleggSchemaContextStrip({
  buildingSlug,
  schemaTemplateId,
  points,
  className,
}: Props) {
  const context = useMemo(
    () =>
      resolveSchemaContextUi({
        buildingSlug,
        schemaTemplateId,
        points,
      }),
    [buildingSlug, schemaTemplateId, points],
  );

  if (context.links.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 dark:bg-muted/10 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {context.caption ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {context.caption}
        </p>
      ) : (
        <span className="hidden sm:block" />
      )}
      <nav
        aria-label="Koblinger til styring og relaterte anlegg"
        className="flex flex-wrap items-center gap-x-3 gap-y-1"
      >
        {context.links.map((link) => (
          <Link
            key={link.href + link.label}
            href={link.href}
            className="group inline-flex flex-col text-left sm:items-end"
          >
            <span className="text-xs font-medium text-foreground underline-offset-2 group-hover:underline">
              {link.label}
            </span>
            {link.hint ? (
              <span className="text-[10px] text-muted-foreground">{link.hint}</span>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
