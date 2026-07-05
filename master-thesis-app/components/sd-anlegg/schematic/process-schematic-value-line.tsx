"use client";

import type { ReactNode } from "react";
import type { SlotDisplayLine } from "@/lib/sd-anlegg/format-process-slot-display";
import {
  SD_ANLEGG_PROCESS_VALUE,
  SD_ANLEGG_PROCESS_VALUE_ALARM,
  SD_ANLEGG_PROCESS_VALUE_CHIP,
  SD_ANLEGG_PROCESS_VALUE_CHIP_EMPHASIS,
  SD_ANLEGG_PROCESS_VALUE_LINK,
  SD_ANLEGG_PROCESS_VALUE_MUTED,
  SD_ANLEGG_PROCESS_VALUE_SLOT,
  SD_ANLEGG_PROCESS_VALUE_STATUS,
} from "./styles/process-schematic-styles";
import { cn } from "@/lib/utils";

type Props = {
  line: SlotDisplayLine;
  alarm?: boolean;
  muted?: boolean;
  className?: string;
  chip?: boolean;
  status?: boolean;
  linkOnHover?: boolean;
};

export function ProcessSchematicValueLine({
  line,
  alarm = false,
  muted = false,
  className,
  chip = false,
  status = false,
  linkOnHover = false,
}: Props) {
  const chipClass = status
    ? SD_ANLEGG_PROCESS_VALUE_CHIP
    : SD_ANLEGG_PROCESS_VALUE_CHIP_EMPHASIS;

  const wrap = (node: ReactNode) =>
    chip ? (
      <span className={cn(chipClass, "inline-flex max-w-full", className)}>{node}</span>
    ) : (
      <span className={cn("inline-flex max-w-full", className)}>{node}</span>
    );

  if (alarm) {
    return wrap(
      <span className={SD_ANLEGG_PROCESS_VALUE_ALARM}>
        {line.label ? `${line.label} ${line.displayValue}` : line.displayValue}
      </span>,
    );
  }

  const valueClass = cn(
    muted ? SD_ANLEGG_PROCESS_VALUE_MUTED : SD_ANLEGG_PROCESS_VALUE,
    status && SD_ANLEGG_PROCESS_VALUE_STATUS,
    linkOnHover && SD_ANLEGG_PROCESS_VALUE_LINK,
    SD_ANLEGG_PROCESS_VALUE_SLOT,
  );

  const text =
    line.displayValue && line.displayValue !== "—" ? line.displayValue : null;

  if (text) {
    return wrap(
      <span className={cn("text-center tabular-nums", valueClass)}>
        {line.label ? (
          <>
            <span className="text-[0.85em] font-medium text-muted-foreground">
              {line.label}{" "}
            </span>
            {text}
          </>
        ) : (
          text
        )}
      </span>,
    );
  }

  return wrap(
    <span className={cn("text-center tabular-nums", valueClass)}>—</span>,
  );
}
