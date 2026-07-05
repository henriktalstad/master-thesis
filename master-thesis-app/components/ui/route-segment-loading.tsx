"use client";

import { SubtlePendingIndicator } from "@/components/ui/subtle-pending-indicator";
import { Spinner, type SpinnerProps } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type RouteSegmentLoadingProps = {
  label: string;
  className?: string;
  minHeightClassName?: string;
  layout?: "stack" | "inline";
  spinnerSize?: number;
  spinnerClassName?: string;
  spinnerVariant?: SpinnerProps["variant"];
  /** Stripe + dots + synlig tekst som standard; sett `hideVisibleLabel` for kun stripe (f.eks. under skjelett). */
  subtle?: boolean;
  anchorTop?: boolean;
  hideVisibleLabel?: boolean;
};

/**
 * Lasting for `loading.tsx` / Suspense uten side-spesifikt skjelett.
 *
 * - `subtle`: stripe + sentrert dots + tekst (som standard).
 * - `subtle` + `hideVisibleLabel`: kun stripe + `sr-only` (unngå duplikat under skjelett).
 * - Uten `subtle`: sentrert `Spinner` + tekst.
 */
export function RouteSegmentLoading({
  label,
  className,
  minHeightClassName,
  layout = "stack",
  spinnerSize,
  spinnerClassName,
  spinnerVariant = "ring",
  subtle = false,
  anchorTop,
  hideVisibleLabel,
}: RouteSegmentLoadingProps) {
  const effectiveHideVisibleLabel = hideVisibleLabel ?? false;
  const effectiveAnchorTop = anchorTop ?? subtle;

  if (subtle) {
    const alignTop = effectiveAnchorTop && effectiveHideVisibleLabel;
    return (
      <div
        className={cn(
          "flex w-full flex-col",
          alignTop ? "items-stretch" : "items-center",
        )}
      >
        <div
          className={cn(
            "flex w-full min-w-0",
            alignTop
              ? "items-stretch justify-start py-2 sm:py-3"
              : "flex-col items-center justify-center py-4 sm:py-5",
            minHeightClassName ?? (alignTop ? "min-h-0" : "min-h-[10vh]"),
            className,
          )}
        >
          <SubtlePendingIndicator
            label={label}
            hideVisibleLabel={effectiveHideVisibleLabel}
            spinnerVariant={spinnerVariant}
            spinnerSize={spinnerSize}
          />
        </div>
      </div>
    );
  }

  const size = spinnerSize ?? (layout === "stack" ? 32 : 20);
  const spinner = (
    <Spinner
      decorative
      variant={spinnerVariant}
      size={size}
      className={cn("shrink-0 text-primary", spinnerClassName)}
      label={label}
    />
  );

  const inner =
    layout === "stack" ? (
      <div className="flex flex-col items-center gap-3">
        {spinner}
        <p className="text-sm text-muted-foreground" aria-hidden="true">
          {label}
        </p>
      </div>
    ) : (
      <div className="inline-flex items-center gap-2 text-muted-foreground">
        {spinner}
        <span aria-hidden="true">{label}</span>
      </div>
    );

  return (
    <output
      className={cn(
        "flex w-full items-center justify-center py-10",
        minHeightClassName ?? "min-h-[min(42vh,240px)]",
        className,
      )}
      
      aria-live="polite"
      aria-label={label}
    >
      {inner}
    </output>
  );
}
