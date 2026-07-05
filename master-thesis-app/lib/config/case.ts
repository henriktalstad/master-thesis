import { resolveBuildingSlug } from "@/lib/config/thesis-case";

/** Klient-sikre case-verdier (NEXT_PUBLIC_*). */
export const CASE = {
  buildingSlug: resolveBuildingSlug(),
  unitSlug: process.env.NEXT_PUBLIC_AHU_UNIT_SLUG ?? "",
  unitKey: process.env.NEXT_PUBLIC_AHU_UNIT_KEY ?? "",
  ahuLabel: process.env.NEXT_PUBLIC_AHU_LABEL ?? "",
  displayName: process.env.NEXT_PUBLIC_BUILDING_DISPLAY_NAME ?? "Nærbyen",
  address: process.env.NEXT_PUBLIC_BUILDING_ADDRESS ?? "",
  priceAreaCode: process.env.NEXT_PUBLIC_PRICE_AREA ?? "NO3",
} as const;

export function sdAnleggVentilationPath(
  unitSlug: string,
  buildingSlug = CASE.buildingSlug,
) {
  if (!buildingSlug || !unitSlug) return "/sd-anlegg";
  return `/sd-anlegg/${buildingSlug}/ventilasjon/${unitSlug}`;
}

export function sdAnleggStyringPath(buildingSlug = CASE.buildingSlug) {
  if (!buildingSlug) return "/sd-anlegg";
  return `/sd-anlegg/${buildingSlug}/styring`;
}
