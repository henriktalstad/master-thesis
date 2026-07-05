import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { infraspawnPointHaystack } from "@/lib/infraspawn/point-haystack";
import { scoreInfraspawnDashboardRole } from "@/lib/infraspawn/point-vocabulary";
import type { InfraspawnKeyPointRole } from "@/lib/infraspawn/point-vocabulary";
import { HEATING_DISTRICT_COMBINED_UNIT_KEY } from "./heating-process-units";

export type SdAnleggKpiSlotId =
  | "outdoor_temp"
  | "system_status"
  | "frost_guard"
  | "sfp"
  | "supply_temp"
  | "return_temp";

export type SdAnleggKpiSlotDefinition = {
  id: SdAnleggKpiSlotId;
  label: string;
  match: (haystack: string) => boolean;
  dashboardRole?: InfraspawnKeyPointRole;
};

export const SD_ANLEGG_KPI_SLOTS: SdAnleggKpiSlotDefinition[] = [
  {
    id: "outdoor_temp",
    label: "Utetemperatur",
    dashboardRole: "outdoor_temp",
    match: (haystack) => /utetemp|outdoor|ute.?temp/i.test(haystack),
  },
  {
    id: "supply_temp",
    label: "Turtemperatur",
    dashboardRole: "supply_temp",
    match: (haystack) => /turtemp|turvann|320[\d.]*RT402/i.test(haystack),
  },
  {
    id: "return_temp",
    label: "Returtemperatur",
    dashboardRole: "return_temp",
    match: (haystack) => /returtemp|returvann|320[\d.]*RT502/i.test(haystack),
  },
  {
    id: "system_status",
    label: "Systemstatus",
    match: (haystack) => /systemstatus|system.?status|drift/i.test(haystack),
  },
  {
    id: "frost_guard",
    label: "Frostvakt",
    match: (haystack) => /frostvakt|frost.?guard|frost/i.test(haystack),
  },
  {
    id: "sfp",
    label: "SFP",
    match: (haystack) => /\bsfp\b|specific.?fan.?power/i.test(haystack),
  },
];

export type SdAnleggKpiSlotValue = {
  slotId: SdAnleggKpiSlotId;
  label: string;
  /** Undertekst under verdien — overstyrer punktets visningsnavn når satt. */
  detailLabel?: string;
  point: InfraspawnPointListItem;
};

/** KPI for 320.001-3: primær OE001, ikke sekundær RT402/RT502. */
const HEATING_COMBINED_KPI_SLOTS: SdAnleggKpiSlotDefinition[] = [
  {
    id: "outdoor_temp",
    label: "Utetemperatur",
    match: (haystack) => /utetemp|outdoor|ute.?temp|320\.001RT901/i.test(haystack),
  },
  {
    id: "supply_temp",
    label: "Primær tur",
    dashboardRole: "supply_temp",
    match: (haystack) =>
      /320001OE001.*turtemp|320001OE001_turtemp/i.test(haystack),
  },
  {
    id: "return_temp",
    label: "Primær retur",
    dashboardRole: "return_temp",
    match: (haystack) =>
      /320001OE001.*returtemp|320001OE001_returtemp/i.test(haystack),
  },
];

function resolveKpiSlotDefinitions(
  unitKey?: string,
): readonly SdAnleggKpiSlotDefinition[] {
  if (unitKey === HEATING_DISTRICT_COMBINED_UNIT_KEY) {
    return HEATING_COMBINED_KPI_SLOTS;
  }
  return SD_ANLEGG_KPI_SLOTS;
}

function resolveKpiDetailLabel(
  slot: SdAnleggKpiSlotDefinition,
  point: InfraspawnPointListItem,
  unitKey?: string,
): string | undefined {
  if (unitKey !== HEATING_DISTRICT_COMBINED_UNIT_KEY) return undefined;

  switch (slot.id) {
    case "supply_temp":
    case "return_temp":
      return "OE001 · Primær fjernvarme";
    case "outdoor_temp":
      return point.objectName?.trim() || "RT901";
    default:
      return undefined;
  }
}

export function resolveSdAnleggKpiSlots(
  points: readonly InfraspawnPointListItem[],
  unitKey?: string,
): SdAnleggKpiSlotValue[] {
  const slotDefinitions = resolveKpiSlotDefinitions(unitKey);
  const usedObjectIds = new Set<string>();
  const results: SdAnleggKpiSlotValue[] = [];

  for (const slot of slotDefinitions) {
    let best: { point: InfraspawnPointListItem; score: number } | null = null;

    for (const point of points) {
      if (usedObjectIds.has(`${point.sourceId}:${point.objectId}`)) continue;
      const haystack = infraspawnPointHaystack(point);
      if (!slot.match(haystack)) continue;

      const score =
        slot.dashboardRole != null
          ? scoreInfraspawnDashboardRole(slot.dashboardRole, point)
          : 1;
      if (score <= 0) continue;
      if (!best || score > best.score) {
        best = { point, score };
      }
    }

    if (best) {
      usedObjectIds.add(`${best.point.sourceId}:${best.point.objectId}`);
      const detailLabel = resolveKpiDetailLabel(slot, best.point, unitKey);
      results.push({
        slotId: slot.id,
        label: slot.label,
        ...(detailLabel ? { detailLabel } : {}),
        point: best.point,
      });
    }
  }

  return results;
}
