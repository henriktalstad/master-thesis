"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { SD_ANLEGG_KEY_POINT_TILE } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type SkeletonProps = {
  rows?: number;
  className?: string;
};

export function SdAnleggOverviewWidgetSkeleton({
  rows = 4,
  className,
}: SkeletonProps) {
  return (
    <ul className={cn("mt-3 space-y-1.5", className)} aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <li key={index}>
          <Skeleton className="h-10 w-full rounded-lg" />
        </li>
      ))}
    </ul>
  );
}

export function SdAnleggOverviewKeyPointsSkeleton() {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-2" aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index}>
          <div
            className={cn(
              SD_ANLEGG_KEY_POINT_TILE,
              "flex min-h-[4.25rem] flex-col justify-center gap-2",
            )}
          >
            <Skeleton className="h-3 w-[68%] rounded-sm" />
            <Skeleton className="h-6 w-[45%] rounded-sm" />
          </div>
        </li>
      ))}
    </ul>
  );
}
