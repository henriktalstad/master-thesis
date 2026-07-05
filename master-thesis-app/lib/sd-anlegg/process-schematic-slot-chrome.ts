import type { AhuSlotRole } from "./ahu-blueprint";

export type ProcessSchematicSlotPresentation = {
  symbolVariant: "inline" | "stalk" | "box" | "hidden";
  symbolSizeClass: string;
  useSymbolBox: boolean;
  hideSymbol: boolean;
  valueMaxWidthClass: string;
  valuePosition: "above" | "below";
  statusTypography: boolean;
  primaryValueEmphasis: boolean;
};

const DEFAULT: ProcessSchematicSlotPresentation = {
  symbolVariant: "box",
  symbolSizeClass: "size-[1.35em]",
  useSymbolBox: true,
  hideSymbol: false,
  valueMaxWidthClass: "max-w-[6em]",
  valuePosition: "below",
  statusTypography: false,
  primaryValueEmphasis: false,
};

const BY_ROLE: Record<AhuSlotRole, ProcessSchematicSlotPresentation> = {
  temp: {
    symbolVariant: "stalk",
    symbolSizeClass: "h-[1.55em] w-[0.85em]",
    useSymbolBox: false,
    hideSymbol: false,
    valueMaxWidthClass: "max-w-[4.75em]",
    valuePosition: "below",
    statusTypography: false,
    primaryValueEmphasis: false,
  },
  filter: {
    symbolVariant: "hidden",
    symbolSizeClass: "",
    useSymbolBox: false,
    hideSymbol: true,
    valueMaxWidthClass: "max-w-[4.5em]",
    valuePosition: "below",
    statusTypography: false,
    primaryValueEmphasis: false,
  },
  fan: {
    symbolVariant: "inline",
    symbolSizeClass: "size-[1.4em]",
    useSymbolBox: false,
    hideSymbol: false,
    valueMaxWidthClass: "max-w-[5.5em]",
    valuePosition: "above",
    statusTypography: false,
    primaryValueEmphasis: false,
  },
  damper: {
    symbolVariant: "inline",
    symbolSizeClass: "size-[1.2em]",
    useSymbolBox: false,
    hideSymbol: false,
    valueMaxWidthClass: "max-w-[5em]",
    valuePosition: "below",
    statusTypography: true,
    primaryValueEmphasis: false,
  },
  pressure: {
    symbolVariant: "inline",
    symbolSizeClass: "size-[1.2em]",
    useSymbolBox: false,
    hideSymbol: false,
    valueMaxWidthClass: "max-w-[4.75em]",
    valuePosition: "below",
    statusTypography: false,
    primaryValueEmphasis: false,
  },
  hx: {
    symbolVariant: "inline",
    symbolSizeClass: "h-[1.85em] w-[1.05em]",
    useSymbolBox: false,
    hideSymbol: false,
    valueMaxWidthClass: "max-w-[5.5em]",
    valuePosition: "above",
    statusTypography: false,
    primaryValueEmphasis: true,
  },
  pump: {
    symbolVariant: "inline",
    symbolSizeClass: "size-[1.25em]",
    useSymbolBox: false,
    hideSymbol: false,
    valueMaxWidthClass: "max-w-[4.5em]",
    valuePosition: "below",
    statusTypography: true,
    primaryValueEmphasis: false,
  },
  valve: {
    symbolVariant: "inline",
    symbolSizeClass: "size-[1.2em]",
    useSymbolBox: false,
    hideSymbol: false,
    valueMaxWidthClass: "max-w-[4.5em]",
    valuePosition: "below",
    statusTypography: false,
    primaryValueEmphasis: false,
  },
  coil: {
    symbolVariant: "inline",
    symbolSizeClass: "size-[1.2em]",
    useSymbolBox: false,
    hideSymbol: false,
    valueMaxWidthClass: "max-w-[4.5em]",
    valuePosition: "above",
    statusTypography: false,
    primaryValueEmphasis: false,
  },
  status: DEFAULT,
};

export function resolveProcessSchematicSlotPresentation(
  role: AhuSlotRole,
): ProcessSchematicSlotPresentation {
  return BY_ROLE[role] ?? DEFAULT;
}
