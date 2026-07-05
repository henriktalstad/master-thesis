"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ControlDataQuality } from "@/lib/sd-anlegg/control/control-types";
import {
  SD_ANLEGG_BTN_PRESS,
  SD_ANLEGG_CARD,
  SD_ANLEGG_STAT_TILE,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  dataQuality: ControlDataQuality;
  sdSignalCoveragePct: number;
  loadedSdCanonicalCount: number;
  /** Skjul KPI-rutenett når dekning allerede vises i SetupCoverageHero. */
  hideSummary?: boolean;
};

export function SdAnleggControlDataQuality({
  dataQuality,
  loadedSdCanonicalCount,
  hideSummary = false,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailTiles = [
    { label: "Signaler lastet", value: String(loadedSdCanonicalCount) },
    { label: "Energi-timer", value: String(dataQuality.energyHourCount) },
    { label: "Vær-timer", value: String(dataQuality.weatherHourCount) },
    { label: "Pris-timer", value: String(dataQuality.priceHourCount) },
  ];

  const hasCriticalGap = dataQuality.missingCritical.length > 0;

  return (
    <div className={cn(SD_ANLEGG_CARD, "overflow-hidden p-4 sm:p-5")}>
      {!hideSummary ? (
        <div className="mb-3 space-y-0.5">
          <h3 className="text-sm font-semibold text-foreground">Datakvalitet</h3>
          <p className="text-xs text-muted-foreground">
            Grunnlag for skyggesimulering de siste {dataQuality.historyDays} dagene.
          </p>
        </div>
      ) : (
        <h3 className="mb-3 text-sm font-semibold text-foreground">Datakvalitet</h3>
      )}

      {hasCriticalGap ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
          <p className="font-medium text-foreground">Mangler kritiske signaler</p>
          <p className="mt-1 text-muted-foreground">
            {dataQuality.missingCritical.join(" · ")}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Kritiske signaler er tilgjengelige for simulering.
        </p>
      )}

      {dataQuality.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {dataQuality.warnings.map((warning) => (
            <li key={warning} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className={cn(
          "mt-4 flex w-full items-center justify-between gap-2 border-t border-border/60 pt-3 text-left text-xs font-medium text-muted-foreground",
          SD_ANLEGG_BTN_PRESS,
        )}
        aria-expanded={detailsOpen}
      >
        <span>Flere datapunkter</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 motion-safe:transition-transform motion-safe:duration-150",
            detailsOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {detailsOpen ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {detailTiles.map((tile) => (
            <div key={tile.label} className={SD_ANLEGG_STAT_TILE}>
              <p className="text-xs text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                {tile.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
