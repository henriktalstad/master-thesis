"use client";

import { useState } from "react";
import { ChevronDown, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MpcEvalCoverageSummary } from "@/lib/sd-anlegg/control/control-types";
import {
  buildMpcDatasetProvenanceDetails,
  formatMpcDatasetProvenanceLine,
} from "@/lib/sd-anlegg/control/format-dataset-provenance";
import { SD_ANLEGG_BTN_PRESS, SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  mpcEvalCoverage: MpcEvalCoverageSummary | null;
  /** Kompakt énlinje uten utvidbar detalj. */
  variant?: "strip" | "inline" | "compact";
  className?: string;
};

export function SdAnleggControlDatasetProvenance({
  mpcEvalCoverage,
  variant = "strip",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const provenance = mpcEvalCoverage?.datasetProvenance;
  const line = formatMpcDatasetProvenanceLine({
    stepCount: mpcEvalCoverage?.stepCount ?? 0,
    provenance,
  });

  if (!line && !provenance) return null;

  const details = buildMpcDatasetProvenanceDetails(provenance);

  if (variant === "compact") {
    return (
      <span className={cn("text-[11px] text-muted-foreground", className)}>
        {line}
      </span>
    );
  }

  if (variant === "inline") {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        <span className="font-medium text-foreground/80">Datasett:</span> {line}
        {provenance?.gapFillApplied ? (
          <span className="text-muted-foreground/80"> · gap-fill aktiv</span>
        ) : null}
      </p>
    );
  }

  return (
    <div
      className={cn(
        SD_ANLEGG_CARD,
        "flex flex-col gap-2 px-4 py-2.5 sm:px-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Database
            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="h-5 px-2 text-[10px] font-normal"
              >
                Postgres
              </Badge>
              <p className="text-xs leading-snug text-foreground">{line}</p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Replay og simulering leser eval-datasett fra databasen. Influx brukes
              kun til backfill inn i Postgres.
            </p>
          </div>
        </div>
        {details.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground",
              SD_ANLEGG_BTN_PRESS,
            )}
            aria-expanded={open}
          >
            <ChevronDown
              className={cn(
                "size-3 transition-transform duration-150 ease-out",
                open && "rotate-180",
              )}
              aria-hidden
            />
            {open ? "Skjul tabeller" : "Vis tabeller"}
          </button>
        ) : null}
      </div>

      {open && details.length > 0 ? (
        <dl className="grid gap-1.5 border-t border-border/50 pt-2 sm:grid-cols-2">
          {details.map((row) => (
            <div key={row.label} className="flex flex-col gap-0.5 text-[11px]">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
