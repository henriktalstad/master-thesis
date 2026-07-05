"use client";

import type { StyringAnalysisViewId } from "@/lib/sd-anlegg/control/control-styring-analysis-views";
import { CONTROL_EFFECT_UI } from "@/lib/sd-anlegg/control/control-display-labels";
import { SD_ANLEGG_CARD, SD_ANLEGG_INFO_BANNER } from "@/components/sd-anlegg/sd-anlegg-ui";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = {
  activeView: StyringAnalysisViewId;
  className?: string;
  sectionOnly?: boolean;
};

function BlockSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("rounded-md bg-muted/50", className)} />;
}

function ViewSectionBlocks({ activeView }: { activeView: StyringAnalysisViewId }) {
  if (activeView === "oversikt") {
    return (
      <>
        <Card className={SD_ANLEGG_CARD}>
          <CardHeader className="space-y-2 pb-2">
            <BlockSkeleton className="h-5 w-48" />
            <BlockSkeleton className="h-3 w-64" />
          </CardHeader>
          <CardContent>
            <BlockSkeleton className="h-56 w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card className={SD_ANLEGG_CARD}>
          <CardContent className="grid gap-3 py-6 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <BlockSkeleton key={index} className="h-24 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </>
    );
  }

  if (activeView === "signaler") {
    return (
      <Card className={SD_ANLEGG_CARD}>
        <CardContent className="py-6">
          <BlockSkeleton className="h-72 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (activeView === "pris") {
    return (
      <Card className={SD_ANLEGG_CARD}>
        <CardContent className="grid gap-4 py-6 lg:grid-cols-2">
          <BlockSkeleton className="h-52 w-full rounded-lg" />
          <BlockSkeleton className="h-52 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={SD_ANLEGG_CARD}>
      <CardContent className="space-y-4 py-6">
        <BlockSkeleton className="h-4 w-56" />
        <BlockSkeleton className="h-40 w-full rounded-lg" />
        <BlockSkeleton className="h-40 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export function SdAnleggControlAnalysisPanelSkeleton({
  activeView,
  className,
  sectionOnly = false,
}: Props) {
  return (
    <div
      className={cn("space-y-5", className)}
      aria-busy="true"
      aria-label={CONTROL_EFFECT_UI.loadingViewLabel}
    >
      {sectionOnly ? (
        <p className={cn(SD_ANLEGG_INFO_BANNER, "py-2 text-xs")}>
          {CONTROL_EFFECT_UI.loadingViewLabel}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <BlockSkeleton className="h-5 w-40" />
            <BlockSkeleton className="h-5 w-28" />
          </div>

          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <BlockSkeleton key={index} className="h-8 w-20 rounded-full" />
            ))}
          </div>

          <Card className={SD_ANLEGG_CARD}>
            <CardContent className="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <BlockSkeleton className="h-3 w-24" />
                  <BlockSkeleton className="h-8 w-32" />
                  <BlockSkeleton className="h-3 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <ViewSectionBlocks activeView={activeView} />
    </div>
  );
}
