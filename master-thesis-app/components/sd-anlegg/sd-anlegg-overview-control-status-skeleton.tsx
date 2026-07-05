"use client";

import { Activity } from "lucide-react";
import { SdAnleggOverviewWidget } from "./sd-anlegg-overview-widget";

/** Placeholder mens MPC/styring-oppsummering lastes i Suspense. */
export function SdAnleggOverviewControlStatusSkeleton() {
  return (
    <SdAnleggOverviewWidget
      title="Styring"
      titleId="overview-control-title-skeleton"
      icon={Activity}
      subtitle="Henter styringstatus …"
      isRefreshing
    >
      <div className="mt-3 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted/60" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted/40" />
      </div>
    </SdAnleggOverviewWidget>
  );
}
