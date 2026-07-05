import type { SdAnleggAnleggsenhetDisplayOverride } from "@/lib/sd-anlegg/anleggsenhet-display-overrides";
import type { SdAnleggsenhetPointAssignment } from "@/lib/sd-anlegg/anleggsenhet-point-assignments";
import type { ControlSignalBinding } from "@/lib/sd-anlegg/control/control-signal-bindings";
import type { SdAnleggPointMetadataOverride } from "@/lib/sd-anlegg/point-metadata-overrides";

export type SdAnleggFeaturedPointRef = {
  sourceId: string;
  objectId: string;
  label: string;
};

export type SdAnleggSiteProfileData = {
  displayTitle: string | null;
  heroImageUrl: string | null;
  clientLogoUrl: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactLabel: string | null;
  contactUserId: string | null;
  featuredPointRefs: SdAnleggFeaturedPointRef[];
  pointDisplayOverrides: SdAnleggFeaturedPointRef[];
  anleggsenhetDisplayOverrides: SdAnleggAnleggsenhetDisplayOverride[];
  anleggsenhetPointAssignments: SdAnleggsenhetPointAssignment[];
  pointMetadataOverrides: SdAnleggPointMetadataOverride[];
  controlSignalBindings: ControlSignalBinding[];
};

export type ResolvedSdAnleggSiteProfile = SdAnleggSiteProfileData & {
  buildingName: string;
  buildingImageUrl: string | null;
  contactImageUrl: string | null;
};

function isFeaturedPointRef(value: unknown): value is SdAnleggFeaturedPointRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.sourceId === "string" &&
    typeof record.objectId === "string" &&
    typeof record.label === "string"
  );
}

export function parseFeaturedPointRefs(raw: unknown): SdAnleggFeaturedPointRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isFeaturedPointRef);
}

export function parseSdAnleggSiteProfileInput(
  raw: unknown,
): Partial<SdAnleggSiteProfileData> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const result: Partial<SdAnleggSiteProfileData> = {};

  for (const key of [
    "displayTitle",
    "heroImageUrl",
    "clientLogoUrl",
    "contactName",
    "contactPhone",
    "contactEmail",
    "contactLabel",
    "contactUserId",
  ] as const) {
    const value = record[key];
    if (value === null) result[key] = null;
    else if (typeof value === "string") result[key] = value.trim() || null;
  }

  if ("featuredPointRefs" in record) {
    result.featuredPointRefs = parseFeaturedPointRefs(record.featuredPointRefs);
  }

  return result;
}
