"use client";

import type { SlotDisplayLine } from "@/lib/sd-anlegg/format-process-slot-display";
import { SD_ANLEGG_PROCESS_VALUE_STACK_LABEL } from "./styles/process-schematic-styles";
import { ProcessSchematicValueLine } from "./process-schematic-value-line";

function slotDisplayLineKey(line: SlotDisplayLine, index: number): string {
  if (line.point) {
    return `${line.point.sourceId}:${line.point.objectId}:${line.displayValue}:${line.point.lastSampledAt ?? ""}`;
  }
  return `${line.label ?? "line"}-${line.role}-${line.displayValue}-${index}`;
}

type Props = {
  lines: readonly SlotDisplayLine[];
  muted?: boolean;
  alarm?: boolean;
  statusTypography?: boolean;
  emphasizePrimary?: boolean;
  layout?: "stack" | "inline-labels" | "labeled-stack";
  linkOnHover?: boolean;
};

export function ProcessSchematicValueStack({
  lines,
  muted = false,
  alarm = false,
  statusTypography = false,
  emphasizePrimary = false,
  layout = "stack",
  linkOnHover = false,
}: Props) {
  if (lines.length === 0) return null;

  if (layout === "inline-labels") {
    return (
      <div className="flex flex-col items-end gap-[0.35em]">
        {lines.map((line, index) => (
          <div key={slotDisplayLineKey(line, index)} className="flex flex-col items-end gap-[0.05em]">
            {line.label ? (
              <span className="text-[0.72em] font-medium leading-none text-muted-foreground">
                {line.label}
              </span>
            ) : null}
            <ProcessSchematicValueLine
              line={{ ...line, label: undefined }}
              muted={muted}
              alarm={alarm}
              status={statusTypography}
              chip={emphasizePrimary ? index === 0 : false}
              linkOnHover={linkOnHover}
            />
          </div>
        ))}
      </div>
    );
  }

  if (layout === "labeled-stack") {
    return (
      <div className="flex w-full flex-col items-center gap-[0.18em]">
        {lines.map((line, index) => (
          <div
            key={slotDisplayLineKey(line, index)}
            className="flex w-full flex-col items-center gap-[0.04em] text-center"
          >
            {line.label ? (
              <span className={SD_ANLEGG_PROCESS_VALUE_STACK_LABEL}>
                {line.label}
              </span>
            ) : null}
            <ProcessSchematicValueLine
              line={{ ...line, label: undefined }}
              muted={muted}
              alarm={alarm}
              status={statusTypography}
              chip={emphasizePrimary ? index === 0 : false}
              linkOnHover={linkOnHover}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {lines.map((line, index) => (
        <ProcessSchematicValueLine
          key={slotDisplayLineKey(line, index)}
          line={line}
          alarm={alarm}
          muted={muted}
          status={statusTypography}
          chip={emphasizePrimary ? index === 0 && !line.label : false}
          linkOnHover={linkOnHover}
        />
      ))}
    </>
  );
}
