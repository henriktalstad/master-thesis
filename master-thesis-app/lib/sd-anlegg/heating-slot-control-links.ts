import type { StyringTabId } from "@/lib/sd-anlegg/control/control-styring-tabs";
import type { StyringAnalysisViewId } from "@/lib/sd-anlegg/control/control-styring-analysis-views";
import { controlStyringHref } from "@/lib/sd-anlegg/control/resolve-control-lookback";

export type HeatingSlotStyringLink = {
  tab: StyringTabId;
  analysisView?: StyringAnalysisViewId;
  label: string;
  boundary: "circuit" | "disturbance" | "bms_local";
};

/** Fjernvarme-slots med styring-relevans — aldri MPC u_k. */
const HEATING_SLOT_STYRING_LINKS: Record<string, HeatingSlotStyringLink> = {
  outdoor: {
    tab: "oppsett",
    label: "Utetemperatur",
    boundary: "disturbance",
  },
  "res.oe.power": {
    tab: "analyse",
    analysisView: "energi",
    label: "FV bolig — effekt",
    boundary: "circuit",
  },
  "res.oe.energy": {
    tab: "analyse",
    analysisView: "energi",
    label: "FV bolig — energi",
    boundary: "circuit",
  },
  "com.oe.power": {
    tab: "analyse",
    analysisView: "energi",
    label: "FV næring — effekt",
    boundary: "circuit",
  },
  "com.oe.energy": {
    tab: "analyse",
    analysisView: "energi",
    label: "FV næring — energi",
    boundary: "circuit",
  },
};

export function resolveHeatingSlotStyringLink(
  slotId: string,
): HeatingSlotStyringLink | null {
  if (HEATING_SLOT_STYRING_LINKS[slotId]) {
    return HEATING_SLOT_STYRING_LINKS[slotId]!;
  }
  if (/\.oe\.(supply|return)$/.test(slotId)) {
    return {
      tab: "analyse",
      analysisView: "energi",
      label: "Kretssnitt FV",
      boundary: "circuit",
    };
  }
  return null;
}

export function resolveHeatingSlotStyringHref(
  buildingSlug: string,
  slotId: string,
): { href: string; label: string; tab: StyringTabId } | null {
  const link = resolveHeatingSlotStyringLink(slotId);
  if (!link) return null;
  return {
    href: controlStyringHref(buildingSlug, {
      tab: link.tab,
      analysisView: link.analysisView,
    }),
    label: link.label,
    tab: link.tab,
  };
}

export function resolveHeatingSlotBoundaryHint(slotId: string): string | null {
  const link = resolveHeatingSlotStyringLink(slotId);
  if (link?.boundary === "circuit") return "Kretssnitt";
  if (link?.boundary === "disturbance") return null;
  if (/\.(valve|pump)\d?$/.test(slotId) || slotId.endsWith(".valve")) {
    return "Lokal SD";
  }
  return null;
}

export function hasHeatingCircuitMeterSignals(
  points: readonly { objectName?: string | null }[],
): boolean {
  return points.some((point) =>
    /OE001_(effekt|energi)/i.test(point.objectName ?? ""),
  );
}
