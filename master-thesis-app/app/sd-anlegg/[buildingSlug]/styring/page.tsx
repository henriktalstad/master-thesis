import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { SdAnleggControlWorkspace } from "@/components/sd-anlegg/control";
import { awaitSdAnleggPageParams } from "@/lib/sd-anlegg/await-page-params";
import {
  legacyStyringAnalysisViewHint,
  parseStyringTab,
} from "@/lib/sd-anlegg/control/control-styring-tabs";
import {
  parseStyringAnalysisView,
  type StyringAnalysisViewId,
} from "@/lib/sd-anlegg/control/control-styring-analysis-views";
import {
  parseControlPeriodMode,
  parseStyringSignalGrain,
  resolveControlLookbackDays,
  resolveControlLookbackHours,
  resolveEffectiveStyringGrain,
} from "@/lib/sd-anlegg/control/resolve-control-lookback";
import { isExaminerDemoMode } from "@/lib/sd-anlegg/control/parse-examiner-demo-mode";
import { getCachedSdAnleggBuildingWorkspace } from "@/lib/sd-anlegg/cached-building-data";
import { loadSdAnleggControlWorkspaceData } from "@/lib/sd-anlegg/control/load-control-workspace-data";
import SdAnleggStyringLoading from "./loading";

type Props = {
  params: Promise<{ buildingSlug: string }>;
  searchParams: Promise<{
    dager?: string;
    refresh?: string;
    vis?: string;
    visning?: string;
    grain?: string;
    periode?: string;
    demo?: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { buildingSlug } = await params;
  const workspace = await getCachedSdAnleggBuildingWorkspace(buildingSlug);
  if (!workspace.success) {
    return { title: "Styring · SD-anlegg" };
  }
  const name = workspace.pageData.buildingName;
  return {
    title: `Styring · ${name}`,
    description: `MPC-styring og energisammenligning for ${name}.`,
  };
}

function resolveAnalysisView(
  vis: string | undefined,
  visning: string | undefined,
): StyringAnalysisViewId {
  const legacyHint = legacyStyringAnalysisViewHint(vis);
  if (legacyHint) return legacyHint;
  return parseStyringAnalysisView(visning);
}

async function StyringWorkspaceContent({
  buildingSlug,
  dager,
  refresh,
  vis,
  visning,
  grain,
  periode,
  examinerMode,
}: {
  buildingSlug: string;
  dager?: string;
  refresh?: string;
  vis?: string;
  visning?: string;
  grain?: string;
  periode?: string;
  examinerMode?: boolean;
}) {
  const activeTab = parseStyringTab(vis);
  const analysisView = resolveAnalysisView(vis, visning);
  const periodMode = parseControlPeriodMode(dager, periode);
  const lookbackDays = resolveControlLookbackDays(resolveControlLookbackHours(dager));
  const signalGrain = resolveEffectiveStyringGrain({
    periodMode,
    lookbackDays,
    requested: grain ? parseStyringSignalGrain(grain) : undefined,
  });

  const workspace = await loadSdAnleggControlWorkspaceData(buildingSlug, dager, {
    forceRefresh: refresh === "1",
    mode:
      activeTab === "oppsett"
        ? "oppsett"
        : "styring",
    grain: signalGrain,
    examinerMode,
    periodModeParam: periode,
  });

  if (!workspace) {
    notFound();
  }

  return (
    <SdAnleggControlWorkspace
      workspace={workspace}
      buildingSlug={buildingSlug}
      activeTab={activeTab}
      analysisView={analysisView}
      grain={signalGrain}
      examinerMode={examinerMode}
    />
  );
}

export default async function SdAnleggStyringPage({ params, searchParams }: Props) {
  const [{ buildingSlug }, query] = await Promise.all([
    awaitSdAnleggPageParams(params),
    searchParams,
  ]);

  const examinerMode = isExaminerDemoMode(query.demo);
  if (
    examinerMode &&
    (query.vis !== "analyse" || query.visning !== "oversikt" || query.grain !== "15")
  ) {
    redirect(
      `/sd-anlegg/${buildingSlug}/styring?demo=exam&vis=analyse&visning=oversikt&grain=15`,
    );
  }

  return (
    <Suspense fallback={<SdAnleggStyringLoading />}>
      <StyringWorkspaceContent
        buildingSlug={buildingSlug}
        dager={query.dager}
        refresh={query.refresh}
        vis={query.vis}
        visning={query.visning}
        grain={query.grain}
        periode={query.periode}
        examinerMode={examinerMode}
      />
    </Suspense>
  );
}
