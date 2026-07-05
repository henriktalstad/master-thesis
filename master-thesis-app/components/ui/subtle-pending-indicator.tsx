import { Spinner, type SpinnerProps } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type SubtlePendingIndicatorProps = {
  label: string;
  className?: string;
  /** Kun stripe + spinner (f.eks. shell-chunk uten synlig tekst). */
  hideVisibleLabel?: boolean;
  showTopStripe?: boolean;
  spinnerVariant?: SpinnerProps["variant"];
  spinnerSize?: number;
};

/**
 * Felles diskret indikator: tynn toppstripe + dots.
 * Brukes av `RouteSegmentLoading` (subtle), layout-fallbacks og shell-chunk.
 */
export function SubtlePendingIndicator({
  label,
  className,
  hideVisibleLabel = false,
  showTopStripe = true,
  spinnerVariant = "dots",
  spinnerSize = 14,
}: SubtlePendingIndicatorProps) {
  return (
    <output
      className={cn(
        "flex w-full min-w-0 flex-col",
        !hideVisibleLabel && "items-center",
        className,
      )}
      aria-live="polite"
      aria-label={label}
    >
      {showTopStripe ? (
        <div className="flex justify-center py-0.5 sm:py-1" aria-hidden>
          <div className="h-0.5 w-14 rounded-full bg-muted-foreground/12 motion-safe:animate-pulse sm:w-[4.5rem]" />
        </div>
      ) : null}
      {hideVisibleLabel ? (
        <span className="sr-only">{label}</span>
      ) : (
        <div className="flex w-full flex-col items-center justify-center gap-2 px-2 text-center text-xs text-muted-foreground/75">
          <Spinner
            decorative
            variant={spinnerVariant}
            size={spinnerSize}
            label={label}
            className="shrink-0 text-muted-foreground/45"
          />
          <span aria-hidden="true" className="max-w-md text-pretty">
            {label}
          </span>
        </div>
      )}
    </output>
  );
}

/** Kun animert toppstripe (ingen spinner/tekst). */
export function SubtlePendingStrip() {
  return (
    <div className="flex justify-center py-0.5 sm:py-1" aria-hidden>
      <div className="h-0.5 w-16 rounded-full bg-muted-foreground/12 motion-safe:animate-pulse sm:w-20" />
    </div>
  );
}
