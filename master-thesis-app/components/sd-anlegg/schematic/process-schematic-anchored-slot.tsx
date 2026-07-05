"use client";

import { LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import {
  SD_ANLEGG_PROCESS_CHART_AFFORDANCE,
  SD_ANLEGG_PROCESS_SLOT_INTERACTIVE,
} from "./styles/process-schematic-styles";
import type { ProcessHeatingBranchSide } from "@/lib/sd-anlegg/process-schematic-geometry";
import { ProcessDuctSlotAnchor } from "./process-duct-canvas";

type Props = {
  x: number;
  anchorY: number;
  slotRole: string;
  lane?: string;
  heatingBranchSide?: ProcessHeatingBranchSide;
  anchorAlign?: "center" | "pipe-left" | "pipe-right";
  className?: string;
  onActivate?: () => void;
  ariaLabel?: string;
  children: React.ReactNode;
};

export function ProcessSchematicAnchoredSlot({
  x,
  anchorY,
  slotRole,
  lane,
  heatingBranchSide,
  anchorAlign,
  className,
  onActivate,
  ariaLabel,
  children,
}: Props) {
  const content = onActivate ? (
    <button
      type="button"
      className={cn(
        SD_ANLEGG_PROCESS_SLOT_INTERACTIVE,
        SD_ANLEGG_BTN_PRESS,
        "group/slot relative",
      )}
      onClick={onActivate}
      aria-haspopup="dialog"
      aria-label={ariaLabel}
    >
      {children}
      <span className={SD_ANLEGG_PROCESS_CHART_AFFORDANCE} aria-hidden>
        <LineChart className="size-[0.65em]" strokeWidth={2.25} />
      </span>
    </button>
  ) : (
    children
  );

  return (
    <ProcessDuctSlotAnchor
      x={x}
      anchorY={anchorY}
      slotRole={slotRole}
      lane={lane}
      anchorAlign={
        anchorAlign ??
        (heatingBranchSide === "left"
          ? "pipe-left"
          : heatingBranchSide === "right"
            ? "pipe-right"
            : "center")
      }
      className={className}
    >
      {content}
    </ProcessDuctSlotAnchor>
  );
}
