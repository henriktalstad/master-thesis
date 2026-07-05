import { cn } from "@/lib/utils";

type IndeterminateTopProgressBarProps = {
  /** Navigasjon over root Suspense (høyere z-index). */
  variant?: "root" | "navigation";
  className?: string;
};

/**
 * Tynn indeterminert stripe øverst — samme uttrykk for root Suspense og intern navigasjon.
 */
export function IndeterminateTopProgressBar({
  variant = "root",
  className,
}: IndeterminateTopProgressBarProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed top-0 right-0 left-0 h-0.5 overflow-hidden bg-transparent",
        variant === "navigation" ? "z-9999" : "z-9998",
        className,
      )}
      aria-hidden
    >
      <div className="h-full w-full origin-left animate-progress-indeterminate bg-primary/80" />
    </div>
  );
}
