"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Kompakt trend-indikator for bruk inline med tekst. */
export function TrendIndicator({
  value,
  upIsPositive = false,
  className,
}: {
  value: number | undefined;
  upIsPositive?: boolean;
  className?: string;
}) {
  if (value === undefined || Math.abs(value) < 0.1) return null;

  const isUp = value > 0;
  const isPositive = upIsPositive ? isUp : !isUp;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
        isPositive ? "text-success" : "text-destructive",
        className,
      )}
    >
      {isUp ? (
        <ArrowUpRight className="size-3" />
      ) : (
        <ArrowDownRight className="size-3" />
      )}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}
