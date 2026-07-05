"use client";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { SD_ANLEGG_CHART_SHELL } from "@/components/sd-anlegg/sd-anlegg-ui";

export function ControlChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        SD_ANLEGG_CHART_SHELL,
        "flex h-[min(240px,40vh)] items-center justify-center",
        className,
      )}
    >
      <Spinner variant="ring" className="size-8 text-muted-foreground" />
    </div>
  );
}
