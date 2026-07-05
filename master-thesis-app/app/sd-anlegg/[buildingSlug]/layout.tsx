import type { Metadata } from "next";
import { connection } from "next/server";
import {
  getCachedSdAnleggBuildingWorkspace,
  getCachedSdAnleggSiteProfile,
} from "@/lib/sd-anlegg/cached-building-data";
import { PageShell } from "@/components/dashboard/page-shell";
import { SdAnleggBuildingShell } from "@/components/sd-anlegg/sd-anlegg-building-shell";
import { loadSdAnleggBuildingShellData } from "@/lib/sd-anlegg/load-building-page";

type Props = {
  params: Promise<{ buildingSlug: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { buildingSlug } = await params;
  const [workspace, profile] = await Promise.all([
    getCachedSdAnleggBuildingWorkspace(buildingSlug),
    getCachedSdAnleggSiteProfile(buildingSlug),
  ]);
  if (!workspace.success) {
    return { title: "SD-anlegg" };
  }
  const title =
    profile.success && profile.profile.displayTitle
      ? profile.profile.displayTitle
      : workspace.pageData.buildingName;

  return {
    title: `${title} · SD-anlegg`,
    description: `Live signaler og historikk fra styringssystemet for ${title}.`,
  };
}

export default async function SdAnleggBuildingLayout({ params, children }: Props) {
  const [, { buildingSlug }] = await Promise.all([connection(), params]);
  const { pageData, profile, canEditProfile, initialPoints } =
    await loadSdAnleggBuildingShellData(buildingSlug);

  return (
    <PageShell maxWidth="responsive" contentClassName="pb-8 sm:pb-10">
      <SdAnleggBuildingShell
        pageData={pageData}
        profile={profile}
        initialPoints={initialPoints}
        buildingNav={[]}
        canEditProfile={canEditProfile}
      >
        {children}
      </SdAnleggBuildingShell>
    </PageShell>
  );
}
