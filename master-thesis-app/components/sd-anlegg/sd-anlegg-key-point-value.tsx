"use client";

import { formatSdAnleggKeyPointValueParts } from "@/lib/sd-anlegg/sd-anlegg-display-format";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  SD_ANLEGG_KEY_POINT_UNIT,
  SD_ANLEGG_KEY_POINT_VALUE,
  SD_ANLEGG_KPI_VALUE,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";
import styles from "./sd-anlegg-key-point-value.module.css";

type Props = {
  point: InfraspawnPointListItem;
  variant?: "tile" | "kpi";
};

export function SdAnleggKeyPointValue({ point, variant = "tile" }: Props) {
  const parts = formatSdAnleggKeyPointValueParts(point);

  const valueClass =
    variant === "kpi"
      ? cn("text-3xl tabular-nums sm:text-4xl", SD_ANLEGG_KPI_VALUE)
      : cn("tabular-nums", SD_ANLEGG_KEY_POINT_VALUE, styles.valueSlot);

  if (parts.kind === "empty") {
    return (
      <p className={cn(valueClass, "text-muted-foreground")}>—</p>
    );
  }

  if (parts.kind === "text") {
    return (
      <p className={valueClass} suppressHydrationWarning>
        {parts.text}
      </p>
    );
  }

  return (
    <p className={styles.valueRow}>
      <span
        className={cn(valueClass, "min-w-0 shrink truncate")}
        suppressHydrationWarning
      >
        {parts.value}
      </span>
      {parts.unit ? (
        <span
          className={cn(
            SD_ANLEGG_KEY_POINT_UNIT,
            "shrink-0 whitespace-nowrap",
          )}
        >
          {parts.unit}
        </span>
      ) : null}
    </p>
  );
}
