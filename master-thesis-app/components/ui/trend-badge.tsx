"use client";

import * as React from "react";
import type { VariantProps } from "class-variance-authority";
import { trendBadgeVariants } from "@/components/ui/trend-badge-variants";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

export interface TrendBadgeProps
  extends
    Omit<React.HTMLAttributes<HTMLSpanElement>, "children">,
    VariantProps<typeof trendBadgeVariants> {
  value: number;
  upIsPositive?: boolean;
  invertColors?: boolean;
  showSign?: boolean;
  hideIcon?: boolean;
  useArrowIcon?: boolean;
  tooltipText?: string;
  decimals?: number;
  neutralThreshold?: number;
  suffix?: string;
  pill?: boolean;
  ghost?: boolean;
  outline?: boolean;
  solid?: boolean;
}

export function TrendBadge({
  value,
  upIsPositive = false,
  invertColors = false,
  showSign = true,
  hideIcon = false,
  useArrowIcon = false,
  tooltipText,
  decimals = 1,
  neutralThreshold = 0.1,
  suffix,
  pill = false,
  ghost = false,
  outline = false,
  solid = false,
  size = "sm",
  className,
  ...props
}: TrendBadgeProps) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  const effectiveUpIsPositive = invertColors ? false : upIsPositive;
  const isNeutral = Math.abs(value) < neutralThreshold;
  const isUp = value > 0;
  const isPositive = isNeutral ? false : effectiveUpIsPositive ? isUp : !isUp;

  const getVariant = () => {
    const sentiment = isNeutral
      ? "neutral"
      : isPositive
        ? "positive"
        : "negative";
    if (solid) return `solid-${sentiment}` as const;
    if (ghost) return `ghost-${sentiment}` as const;
    if (outline) return `outline-${sentiment}` as const;
    return `soft-${sentiment}` as const;
  };

  const Icon = isNeutral
    ? Minus
    : useArrowIcon
      ? isUp
        ? ArrowUpRight
        : ArrowDownRight
      : isUp
        ? TrendingUp
        : TrendingDown;

  const formattedValue = Math.abs(value).toFixed(decimals);
  const signPrefix = showSign && !isNeutral ? (isUp ? "+" : "−") : "";
  const displayValue = `${signPrefix}${formattedValue}%${suffix ? ` ${suffix}` : ""}`;

  const badge = (
    <span
      className={cn(
        trendBadgeVariants({
          variant: getVariant(),
          size,
          shape: pill ? "pill" : "rounded",
        }),
        className,
      )}
      {...props}
    >
      {!hideIcon && (
        <Icon
          className={cn(
            "shrink-0",
            size === "xs" && "size-2.5",
            size === "sm" && "size-3",
            size === "md" && "size-3.5",
            size === "lg" && "size-4",
          )}
        />
      )}
      <span>{displayValue}</span>
    </span>
  );

  if (tooltipText) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">{badge}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
