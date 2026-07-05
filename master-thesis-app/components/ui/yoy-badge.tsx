"use client";

import { TrendBadge } from "@/components/ui/trend-badge";

export function YoYBadge({
  value,
  className,
  invertColors = false,
  suffix = "YoY",
}: {
  value: number | null | undefined;
  className?: string;
  invertColors?: boolean;
  suffix?: string;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return (
    <TrendBadge
      value={value}
      suffix={suffix}
      pill
      size="sm"
      upIsPositive={!invertColors}
      className={className}
    />
  );
}
