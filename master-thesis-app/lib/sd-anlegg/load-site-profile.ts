import "server-only";

import { prisma } from "@/lib/db";
import {
  parseFeaturedPointRefs,
  type ResolvedSdAnleggSiteProfile,
} from "@/lib/sd-anlegg/site-profile-schema";
import { parseSiteProfileMetadata, type SdAnleggSiteProfileMetadata } from "@/lib/sd-anlegg/site-profile-metadata";

async function resolveContactImageUrl(
  contactUserId: string | null,
): Promise<string | null> {
  if (!contactUserId) return null;
  const user = await prisma.user.findUnique({
    where: { id: contactUserId },
    select: { imageUrl: true },
  });
  const imageUrl = user?.imageUrl?.trim();
  return imageUrl || null;
}

function mapProfileRecord(
  record: {
    displayTitle: string | null;
    heroImageUrl: string | null;
    clientLogoUrl: string | null;
    contactName: string | null;
    contactPhone: string | null;
    contactLabel: string | null;
    featuredPointRefs: unknown;
    metadata: unknown;
  },
  building: {
    name: string;
    imageUrl: string | null;
  },
  contactImageUrl: string | null,
  metadata: SdAnleggSiteProfileMetadata,
): ResolvedSdAnleggSiteProfile {
  return {
    displayTitle: record.displayTitle ?? building.name,
    heroImageUrl: record.heroImageUrl ?? building.imageUrl,
    clientLogoUrl: record.clientLogoUrl,
    contactName: record.contactName,
    contactPhone: record.contactPhone,
    contactEmail: metadata.contactEmail,
    contactLabel: record.contactLabel,
    contactUserId: metadata.contactUserId,
    contactImageUrl,
    featuredPointRefs: parseFeaturedPointRefs(record.featuredPointRefs),
    pointDisplayOverrides: metadata.pointDisplayOverrides,
    anleggsenhetDisplayOverrides: metadata.anleggsenhetDisplayOverrides,
    anleggsenhetPointAssignments: metadata.anleggsenhetPointAssignments,
    pointMetadataOverrides: metadata.pointMetadataOverrides,
    controlSignalBindings: metadata.controlSignalBindings,
    buildingName: building.name,
    buildingImageUrl: building.imageUrl,
  };
}

export async function loadSdAnleggSiteProfileForBuilding(
  buildingId: string,
): Promise<ResolvedSdAnleggSiteProfile | null> {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: {
      name: true,
      imageUrl: true,
      sdAnleggSiteProfile: true,
    },
  });

  if (!building) return null;

  const profileRecord = building.sdAnleggSiteProfile ?? {
    displayTitle: null,
    heroImageUrl: null,
    clientLogoUrl: null,
    contactName: null,
    contactPhone: null,
    contactLabel: null,
    featuredPointRefs: [],
    metadata: null,
  };

  const metadata = parseSiteProfileMetadata(profileRecord.metadata);
  const contactImageUrl = await resolveContactImageUrl(metadata.contactUserId);

  return mapProfileRecord(profileRecord, building, contactImageUrl, metadata);
}
