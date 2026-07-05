import type { StyringTabId } from "@/lib/sd-anlegg/control/control-styring-tabs";
import type { StyringAnalysisViewId } from "@/lib/sd-anlegg/control/control-styring-analysis-views";
import { controlStyringHref } from "@/lib/sd-anlegg/control/resolve-control-lookback";

export type AhuSlotStyringLink = {
  canonicalId: string;
  tab: StyringTabId;
  analysisView?: StyringAnalysisViewId;
  label: string;
};

/** Prosess-/status-slots med MPC-relevant canonical — 360.102. */
const AHU_SLOT_STYRING_LINKS: Record<string, AhuSlotStyringLink> = {
  "supply.fan": {
    canonicalId: "supply.fan.command",
    tab: "analyse",
    analysisView: "signaler",
    label: "Tilluftsvifte",
  },
  "exhaust.fan": {
    canonicalId: "exhaust.fan.command",
    tab: "analyse",
    analysisView: "signaler",
    label: "Avtrekksvifte",
  },
  "heating.valve": {
    canonicalId: "heating.valve.command",
    tab: "analyse",
    analysisView: "signaler",
    label: "Varmebatteri",
  },
  "heating.cool_valve": {
    canonicalId: "cooling.valve.command",
    tab: "analyse",
    analysisView: "signaler",
    label: "Kjølebatteri",
  },
  "supply.temp_out": {
    canonicalId: "supply.temp",
    tab: "oppsett",
    label: "Tillufttemperatur",
  },
  "exhaust.temp": {
    canonicalId: "extract.temp",
    tab: "analyse",
    analysisView: "signaler",
    label: "Avtrekk (komfort)",
  },
  "supply.temp_in": {
    canonicalId: "intake.temp",
    tab: "oppsett",
    label: "Inntakstemperatur",
  },
  "status.setpoint": {
    canonicalId: "supply.setpoint_calculated",
    tab: "analyse",
    analysisView: "signaler",
    label: "Kalkulert settpunkt",
  },
  "status.system": {
    canonicalId: "system.mode",
    tab: "oppsett",
    label: "Systemstatus",
  },
};

export function resolveAhuSlotStyringLink(
  slotId: string,
): AhuSlotStyringLink | null {
  return AHU_SLOT_STYRING_LINKS[slotId] ?? null;
}

export function resolveAhuSlotStyringHref(
  buildingSlug: string,
  slotId: string,
): { href: string; label: string; tab: StyringTabId } | null {
  const link = resolveAhuSlotStyringLink(slotId);
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
