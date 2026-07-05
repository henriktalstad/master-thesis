import { InfraspawnSystemDomain } from "@/generated/client/enums";
import type { OverviewKeyPointCard } from "@/lib/infraspawn/dashboard-overview";

const HEATING_ROLES = new Set([
  "supply_temp",
  "return_temp",
  "power",
  "energy",
  "flow",
  "valve",
  "pump",
  "volume",
]);

export function resolveOverviewSignalsDomain(
  keyPoints: readonly OverviewKeyPointCard[],
): InfraspawnSystemDomain {
  let heatingScore = 0;
  for (const card of keyPoints) {
    if (HEATING_ROLES.has(card.role)) heatingScore += 1;
  }

  if (
    keyPoints.some(
      (card) => card.role === "supply_temp" || card.role === "return_temp",
    )
  ) {
    return InfraspawnSystemDomain.HEATING;
  }

  return heatingScore > 0
    ? InfraspawnSystemDomain.HEATING
    : InfraspawnSystemDomain.VENTILATION;
}
