"use client";

import {
  formatInfraspawnPointLabel,
  formatInfraspawnPointValue,
} from "@/lib/infraspawn/display-format";
import type { SdAnleggKpiSlotValue } from "@/lib/sd-anlegg/kpi-slots";
import { SD_ANLEGG_KPI_CARD, SD_ANLEGG_KPI_VALUE } from "@/components/sd-anlegg/sd-anlegg-ui";

type Props = {
  slots: readonly SdAnleggKpiSlotValue[];
};

export function SdAnleggKpiStrip({ slots }: Props) {
  if (!slots?.length) return null;

  return (
    <section aria-label="Nøkkeltall" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {slots.map((slot) => (
        <div key={slot.slotId} className={SD_ANLEGG_KPI_CARD}>
          <div className="border-b border-primary/15 bg-primary/[0.04] px-4 py-2 dark:border-primary/20 dark:bg-primary/10">
            <p className="text-xs font-medium text-muted-foreground">{slot.label}</p>
          </div>
          <div className="px-4 py-3">
            <p className={SD_ANLEGG_KPI_VALUE}>
              {formatInfraspawnPointValue(
                slot.point.lastValue,
                slot.point.unit,
                slot.point,
              )}
            </p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {slot.detailLabel ?? formatInfraspawnPointLabel(slot.point)}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
