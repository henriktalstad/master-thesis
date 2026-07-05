import {
  parseAnleggsenhetDisplayOverrides,
  type SdAnleggAnleggsenhetDisplayOverride,
} from "@/lib/sd-anlegg/anleggsenhet-display-overrides";
import {
  parseAnleggsenhetPointAssignments,
  type SdAnleggsenhetPointAssignment,
} from "@/lib/sd-anlegg/anleggsenhet-point-assignments";
import {
  parsePointMetadataOverrides,
  type SdAnleggPointMetadataOverride,
} from "@/lib/sd-anlegg/point-metadata-overrides";
import {
  parseControlSignalBindings,
  type ControlSignalBinding,
} from "@/lib/sd-anlegg/control/control-signal-bindings";
import {
  parseFeaturedPointRefs,
  type SdAnleggFeaturedPointRef,
} from "@/lib/sd-anlegg/site-profile-schema";

export type SdAnleggSiteProfileMetadata = {
  contactUserId: string | null;
  contactEmail: string | null;
  pointDisplayOverrides: SdAnleggFeaturedPointRef[];
  anleggsenhetDisplayOverrides: SdAnleggAnleggsenhetDisplayOverride[];
  anleggsenhetPointAssignments: SdAnleggsenhetPointAssignment[];
  pointMetadataOverrides: SdAnleggPointMetadataOverride[];
  controlSignalBindings: ControlSignalBinding[];
};

function readMetadataString(
  record: Record<string, unknown>,
  key: "contactUserId" | "contactEmail",
): string | null {
  const value = record[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function parseSiteProfileMetadata(raw: unknown): SdAnleggSiteProfileMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      contactUserId: null,
      contactEmail: null,
      pointDisplayOverrides: [],
      anleggsenhetDisplayOverrides: [],
      anleggsenhetPointAssignments: [],
      pointMetadataOverrides: [],
      controlSignalBindings: [],
    };
  }
  const record = raw as Record<string, unknown>;
  return {
    contactUserId: readMetadataString(record, "contactUserId"),
    contactEmail: readMetadataString(record, "contactEmail"),
    pointDisplayOverrides: parseFeaturedPointRefs(record.pointDisplayOverrides),
    anleggsenhetDisplayOverrides: parseAnleggsenhetDisplayOverrides(
      record.anleggsenhetDisplayOverrides,
    ),
    anleggsenhetPointAssignments: parseAnleggsenhetPointAssignments(
      record.anleggsenhetPointAssignments,
    ),
    pointMetadataOverrides: parsePointMetadataOverrides(
      record.pointMetadataOverrides,
    ),
    controlSignalBindings: parseControlSignalBindings(
      record.controlSignalBindings,
    ),
  };
}

export function mergeSiteProfileMetadata(
  existing: unknown,
  patch: Partial<SdAnleggSiteProfileMetadata>,
): SdAnleggSiteProfileMetadata {
  const base = parseSiteProfileMetadata(existing);
  return {
    contactUserId:
      patch.contactUserId !== undefined ? patch.contactUserId : base.contactUserId,
    contactEmail:
      patch.contactEmail !== undefined ? patch.contactEmail : base.contactEmail,
    pointDisplayOverrides:
      patch.pointDisplayOverrides !== undefined
        ? patch.pointDisplayOverrides
        : base.pointDisplayOverrides,
    anleggsenhetDisplayOverrides:
      patch.anleggsenhetDisplayOverrides !== undefined
        ? patch.anleggsenhetDisplayOverrides
        : base.anleggsenhetDisplayOverrides,
    anleggsenhetPointAssignments:
      patch.anleggsenhetPointAssignments !== undefined
        ? patch.anleggsenhetPointAssignments
        : base.anleggsenhetPointAssignments,
    pointMetadataOverrides:
      patch.pointMetadataOverrides !== undefined
        ? patch.pointMetadataOverrides
        : base.pointMetadataOverrides,
    controlSignalBindings:
      patch.controlSignalBindings !== undefined
        ? patch.controlSignalBindings
        : base.controlSignalBindings,
  };
}
