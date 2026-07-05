import {
  formatBuildingAddressesForDisplay,
  toBuildingAddressDisplayInput,
  type BuildingAddressRecord,
} from "@/lib/address-format";

export const sdAnleggBuildingAddressSelect = {
  address: true,
  postCode: true,
  postalPlace: true,
  normalizedAddr: true,
  numberFrom: true,
  numberTo: true,
  letterFrom: true,
  letterTo: true,
  isPrimary: true,
} as const;

export function formatSdAnleggBuildingAddressLine(
  building: BuildingAddressRecord,
): string {
  return formatBuildingAddressesForDisplay(
    toBuildingAddressDisplayInput(building),
  ).summaryLine;
}
