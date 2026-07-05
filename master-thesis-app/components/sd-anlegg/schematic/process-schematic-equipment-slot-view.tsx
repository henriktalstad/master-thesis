"use client";

import { cn } from "@/lib/utils";
import type { AhuSlotRole } from "@/lib/sd-anlegg/ahu-blueprint";
import type { SdComponentType } from "@/lib/sd-anlegg/component-types";
import type { SlotDisplayLine } from "@/lib/sd-anlegg/format-process-slot-display";
import { isAoValveCommandSignal } from "@/lib/sd-anlegg/valve-command-percent";
import { resolveProcessSchematicSlotPresentation } from "@/lib/sd-anlegg/process-schematic-slot-chrome";
import {
  SD_ANLEGG_PROCESS_FILTER_DUCT_STEM_DOWN,
  SD_ANLEGG_PROCESS_FILTER_DUCT_STEM_UP,
  SD_ANLEGG_PROCESS_HEATING_BRANCH_LEFT,
  SD_ANLEGG_PROCESS_HEATING_BRANCH_RIGHT,
  SD_ANLEGG_PROCESS_HEATING_BRANCH_VALUES_LEFT,
  SD_ANLEGG_PROCESS_SLOT_ALARM,
  SD_ANLEGG_PROCESS_SLOT_SELECTED,
  SD_ANLEGG_PROCESS_SYMBOL_BOX,
  SD_ANLEGG_PROCESS_SYMBOL_BOX_SELECTED,
  SD_ANLEGG_PROCESS_SYMBOL_DUCT_STEM_DOWN,
  SD_ANLEGG_PROCESS_SYMBOL_DUCT_STEM_UP,
  SD_ANLEGG_PROCESS_SYMBOL_ICON,
  SD_ANLEGG_PROCESS_SYMBOL_INLINE,
  SD_ANLEGG_PROCESS_SYMBOL_STALK,
  SD_ANLEGG_PROCESS_TAG,
  SD_ANLEGG_PROCESS_TAG_MUTED,
} from "./styles/process-schematic-styles";
import { ProcessSchematicValueStack } from "./process-schematic-value-stack";
import { SdSchematicSymbol } from "./sd-schematic-symbol";

type Props = {
  equipmentCode: string;
  slotRole: AhuSlotRole;
  componentType: SdComponentType;
  displayLines: readonly SlotDisplayLine[];
  stateLabel?: string | null;
  selected?: boolean;
  missing?: boolean;
  alarm?: boolean;
  coilVariant?: "heat" | "cool";
  layout?: "anchored" | "stack" | "hx";
  subtitle?: string;
  lane?: string;
  heatingBranchSide?: "left" | "right";
  interactive?: boolean;
  className?: string;
};

function resolveContainerClass(presentation: ReturnType<typeof resolveProcessSchematicSlotPresentation>) {
  switch (presentation.symbolVariant) {
    case "stalk":
      return SD_ANLEGG_PROCESS_SYMBOL_STALK;
    case "inline":
      return SD_ANLEGG_PROCESS_SYMBOL_INLINE;
    case "box":
      return SD_ANLEGG_PROCESS_SYMBOL_BOX;
    default:
      return SD_ANLEGG_PROCESS_SYMBOL_INLINE;
  }
}

function resolveDuctStemClass(role: AhuSlotRole, lane?: string): string | undefined {
  if (role === "filter") return undefined;
  if (!["fan", "damper", "pressure", "coil", "pump", "valve"].includes(role)) {
    return undefined;
  }
  if (lane === "supply") return SD_ANLEGG_PROCESS_SYMBOL_DUCT_STEM_UP;
  if (lane === "heating") return SD_ANLEGG_PROCESS_SYMBOL_DUCT_STEM_DOWN;
  return SD_ANLEGG_PROCESS_SYMBOL_DUCT_STEM_DOWN;
}

export function ProcessSchematicEquipmentSlotView({
  equipmentCode,
  slotRole,
  componentType,
  displayLines,
  stateLabel,
  selected = false,
  missing = false,
  alarm = false,
  coilVariant,
  layout = "anchored",
  subtitle,
  lane,
  heatingBranchSide,
  interactive = false,
  className,
}: Props) {
  const presentation = resolveProcessSchematicSlotPresentation(slotRole);
  const showStateLabel =
    stateLabel &&
    slotRole === "fan" &&
    !displayLines.some((line) => line.displayValue.includes("%"));

  const valueLines = [...displayLines];
  if (showStateLabel && stateLabel) {
    valueLines.push({ displayValue: stateLabel, role: "command" });
  }

  const tagClass = missing ? SD_ANLEGG_PROCESS_TAG_MUTED : SD_ANLEGG_PROCESS_TAG;
  const valueLayout =
    layout === "hx" ? "labeled-stack"
    : slotRole === "pressure" || slotRole === "temp" ? "inline-labels"
    : "stack";
  const emphasizeValues = presentation.primaryValueEmphasis || slotRole === "temp";
  const valueWrapClass = cn(
    "flex flex-col items-center gap-[0.06em]",
    presentation.valueMaxWidthClass,
  );

  const ductStemClass =
    heatingBranchSide != null ? undefined : resolveDuctStemClass(slotRole, lane);

  const symbol = (
    <div
      className={cn(
        resolveContainerClass(presentation),
        ductStemClass,
        missing && "opacity-55",
        presentation.hideSymbol && "min-h-[0.2em]",
        presentation.useSymbolBox && "size-[1.45em]",
        presentation.useSymbolBox && missing && "bg-muted/20",
        presentation.useSymbolBox && selected && SD_ANLEGG_PROCESS_SYMBOL_BOX_SELECTED,
        selected && !presentation.useSymbolBox && SD_ANLEGG_PROCESS_SLOT_SELECTED,
        alarm && SD_ANLEGG_PROCESS_SLOT_ALARM,
        layout === "hx" && "h-[2.2em] w-[1.25em] shrink-0",
      )}
    >
      {!presentation.hideSymbol ? (
        <SdSchematicSymbol
          type={componentType}
          coilVariant={coilVariant}
          style="process"
          temperatureProbe={lane === "heating" && slotRole === "temp" ? "horizontal" : "vertical"}
          className={cn(
            SD_ANLEGG_PROCESS_SYMBOL_ICON,
            layout === "hx" ? "h-[2.2em] w-[1.25em]" : presentation.symbolSizeClass,
            missing && "opacity-70",
          )}
        />
      ) : null}
    </div>
  );

  const values = (
    <>
      {slotRole === "fan" && valueLines.length > 1 ? (
        <>
          <ProcessSchematicValueStack
            lines={valueLines.slice(0, -1)}
            muted={missing}
            alarm={alarm}
            statusTypography={presentation.statusTypography}
            emphasizePrimary
            layout="stack"
            linkOnHover={interactive}
          />
          <ProcessSchematicValueStack
            lines={valueLines.slice(-1)}
            muted={missing}
            alarm={alarm}
            statusTypography={presentation.statusTypography}
            emphasizePrimary={false}
            layout="stack"
            linkOnHover={interactive}
          />
        </>
      ) : (
        <>
          <ProcessSchematicValueStack
            lines={valueLines}
            muted={missing}
            alarm={alarm}
            statusTypography={presentation.statusTypography}
            emphasizePrimary={emphasizeValues}
            layout={valueLayout}
            linkOnHover={interactive}
          />
        </>
      )}
    </>
  );

  if (slotRole === "filter" && layout === "anchored") {
    return (
      <div
        className={cn(
          "group/slot relative flex flex-col items-center gap-[0.06em]",
          lane === "supply"
            ? SD_ANLEGG_PROCESS_FILTER_DUCT_STEM_UP
            : SD_ANLEGG_PROCESS_FILTER_DUCT_STEM_DOWN,
          className,
        )}
      >
        <span className={tagClass}>{equipmentCode}</span>
        <div className={valueWrapClass}>
          <ProcessSchematicValueStack
            lines={valueLines}
            muted={missing}
            alarm={alarm}
            linkOnHover={interactive}
          />
        </div>
      </div>
    );
  }

  if (heatingBranchSide === "left" && layout === "anchored") {
    return (
      <div className={cn("group/slot", SD_ANLEGG_PROCESS_HEATING_BRANCH_LEFT, className)}>
        <div className={cn(SD_ANLEGG_PROCESS_HEATING_BRANCH_VALUES_LEFT, valueWrapClass)}>
          <span className={tagClass}>{equipmentCode}</span>
          {values}
        </div>
        {symbol}
      </div>
    );
  }

  if (heatingBranchSide === "right" && layout === "anchored") {
    const branchValues =
      slotRole === "valve"
        ? valueLines.filter(
            (line) =>
              line.role === "command" ||
              line.displayValue.includes("%") ||
              line.point != null && isAoValveCommandSignal(line.point),
          )
        : valueLines;

    return (
      <div className={cn("group/slot", SD_ANLEGG_PROCESS_HEATING_BRANCH_RIGHT, className)}>
        <div
          className={cn(
            SD_ANLEGG_PROCESS_HEATING_BRANCH_VALUES_LEFT,
            valueWrapClass,
            "max-w-[3.75em]",
          )}
        >
          <span className={tagClass}>{equipmentCode}</span>
          {branchValues.length > 0 ? (
            <ProcessSchematicValueStack
              lines={branchValues}
              muted={missing}
              alarm={alarm}
              linkOnHover={interactive}
            />
          ) : null}
        </div>
        {symbol}
      </div>
    );
  }

  if (slotRole === "fan" && layout === "anchored") {
    const flowLines = valueLines.length > 1 ? valueLines.slice(0, -1) : valueLines;
    const tailLines = valueLines.length > 1 ? valueLines.slice(-1) : [];

    return (
      <div className={cn("group/slot flex flex-col items-center gap-[0.08em]", className)}>
        {flowLines.length > 0 ? (
          <div className={valueWrapClass}>
            <ProcessSchematicValueStack
              lines={flowLines}
              muted={missing}
              alarm={alarm}
              statusTypography={presentation.statusTypography}
              emphasizePrimary
              linkOnHover={interactive}
            />
          </div>
        ) : null}
        {symbol}
        <span className={tagClass}>{equipmentCode}</span>
        {tailLines.length > 0 ? (
          <ProcessSchematicValueStack
            lines={tailLines}
            muted={missing}
            alarm={alarm}
            linkOnHover={interactive}
          />
        ) : null}
      </div>
    );
  }

  if (layout === "hx") {
    return (
      <div
        className={cn(
          "group/slot flex max-w-[8.5em] flex-row items-center justify-end gap-[0.42em]",
          missing && "opacity-60",
          className,
        )}
      >
        <div className={cn("flex min-w-0 flex-col items-end gap-[0.08em] pr-[0.1em]", valueWrapClass)}>
          <ProcessSchematicValueStack
            lines={valueLines}
            muted={missing}
            alarm={alarm}
            statusTypography={presentation.statusTypography}
            emphasizePrimary={emphasizeValues}
            layout="labeled-stack"
            linkOnHover={interactive}
          />
        </div>
        <div className="flex shrink-0 flex-col items-center gap-[0.06em]">
          <span className={tagClass}>{equipmentCode}</span>
          {symbol}
        </div>
      </div>
    );
  }

  if (slotRole === "coil" && lane === "heating" && layout === "anchored") {
    return (
      <div className={cn("group/slot flex flex-col items-center gap-[0.05em]", className)}>
        <div className={cn(resolveContainerClass(presentation), SD_ANLEGG_PROCESS_SYMBOL_DUCT_STEM_UP)}>
          {!presentation.hideSymbol ? (
            <SdSchematicSymbol
              type={componentType}
              coilVariant={coilVariant}
              style="process"
              className={cn(SD_ANLEGG_PROCESS_SYMBOL_ICON, "size-[1.15em]", missing && "opacity-70")}
            />
          ) : null}
        </div>
        <span className={tagClass}>{equipmentCode}</span>
        {valueLines.some((line) => line.role === "command") ? (
          <div className={valueWrapClass}>
            <ProcessSchematicValueStack
              lines={valueLines.filter((line) => line.role === "command")}
              muted={missing}
              alarm={alarm}
              linkOnHover={interactive}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (lane === "supply" && slotRole === "temp" && layout === "anchored") {
    return (
      <div className={cn("group/slot flex flex-col items-center gap-[0.06em]", className)}>
        <div className={cn(resolveContainerClass(presentation), SD_ANLEGG_PROCESS_SYMBOL_DUCT_STEM_UP)}>
          {!presentation.hideSymbol ? (
            <SdSchematicSymbol
              type={componentType}
              coilVariant={coilVariant}
              style="process"
              className={cn(SD_ANLEGG_PROCESS_SYMBOL_ICON, presentation.symbolSizeClass, missing && "opacity-70")}
            />
          ) : null}
        </div>
        <span className={tagClass}>{equipmentCode}</span>
        <div className={valueWrapClass}>
          <ProcessSchematicValueStack
            lines={valueLines}
            muted={missing}
            alarm={alarm}
            emphasizePrimary={emphasizeValues}
            layout="stack"
            linkOnHover={interactive}
          />
        </div>
      </div>
    );
  }

  if (lane === "exhaust" && slotRole === "temp" && layout === "anchored") {
    return (
      <div className={cn("group/slot flex flex-col items-center gap-[0.06em]", className)}>
        <span className={tagClass}>{equipmentCode}</span>
        <div className={valueWrapClass}>
          <ProcessSchematicValueStack
            lines={valueLines}
            muted={missing}
            alarm={alarm}
            emphasizePrimary={emphasizeValues}
            layout="stack"
            linkOnHover={interactive}
          />
        </div>
        <div className={cn(resolveContainerClass(presentation), SD_ANLEGG_PROCESS_SYMBOL_DUCT_STEM_DOWN)}>
          {!presentation.hideSymbol ? (
            <SdSchematicSymbol
              type={componentType}
              coilVariant={coilVariant}
              style="process"
              className={cn(SD_ANLEGG_PROCESS_SYMBOL_ICON, presentation.symbolSizeClass, missing && "opacity-70")}
            />
          ) : null}
        </div>
      </div>
    );
  }

  if (layout === "stack") {
    const showPumpState =
      slotRole === "pump" &&
      stateLabel &&
      stateLabel !== valueLines[0]?.displayValue;

    return (
      <div className={cn("group/slot flex flex-col items-center", className)}>
        <span className={tagClass}>{equipmentCode}</span>
        <div className="mt-[0.12em]">{symbol}</div>
        {subtitle ? (
          <span className="mt-0.5 max-w-full truncate text-center text-[0.72em] leading-tight text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
        <div className={cn("mt-[0.15em]", valueWrapClass)}>{values}</div>
        {showPumpState ? (
          <span
            className={cn(
              "mt-0.5 text-center text-[0.72em] font-semibold leading-tight",
              presentation.statusTypography
                ? "text-muted-foreground"
                : "text-foreground/85",
            )}
          >
            {stateLabel}
          </span>
        ) : null}
      </div>
    );
  }

  const valuesAbove = presentation.valuePosition === "above";

  return (
    <div className={cn("group/slot flex flex-col items-center gap-[0.08em]", className)}>
      <span className={tagClass}>{equipmentCode}</span>
      {valuesAbove ? <div className={valueWrapClass}>{values}</div> : null}
      {symbol}
      {!valuesAbove ? <div className={valueWrapClass}>{values}</div> : null}
    </div>
  );
}
