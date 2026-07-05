"use client";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const TAB_LOADING_BASE =
  "flex min-h-[200px] w-full items-center justify-center rounded-xl border border-border/30 bg-background/60 dark:bg-background/40 backdrop-blur-[2px]";

/**
 * Lastetilstand for innhold inne i faner (oversikt, EOS m.fl.).
 *
 * @param label Kort tekst under spinner (synlig).
 * @param ariaLabel Valgfri kortere tekst for skjermleser; default er `label`.
 */
export function TabLoadingState({
  label,
  ariaLabel,
  spinnerClassName = "text-muted-foreground/50",
  className,
}: {
  label: string;
  ariaLabel?: string;
  spinnerClassName?: string;
  className?: string;
}) {
  return (
    <output
      className={cn(TAB_LOADING_BASE, className)}
      
      aria-label={ariaLabel ?? label}
     aria-live="polite">
      <div className="flex flex-col items-center gap-2.5">
        <Spinner variant="circle" size={20} className={spinnerClassName} />
        <span className="text-xs text-muted-foreground/75 dark:text-muted-foreground/70">
          {label}
        </span>
      </div>
    </output>
  );
}
