"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HeatingCombinedDiagramShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm dark:border-border/90",
        className,
      )}
    >
      {children}
    </div>
  );
}
