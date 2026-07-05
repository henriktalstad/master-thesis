"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Sidebar/trange containere avkorter ofte navn over ~20 tegn. Vis tooltip når avkortet ELLER når teksten er lang. */
const LIKELY_TRUNCATED_LENGTH = 20;

export interface TruncatedTextWithTooltipProps {
  text: string;
  className?: string;
  /** TooltipContent align (default: start for sidebar-lister) */
  align?: "start" | "center" | "end";
  /** Ekstra className på TooltipContent (f.eks. max-w-xs) */
  tooltipClassName?: string;
}

function subscribeToTruncation(
  element: HTMLSpanElement,
  onStoreChange: () => void,
): () => void {
  const check = () => onStoreChange();
  check();
  const raf = requestAnimationFrame(check);
  const ro = new ResizeObserver(check);
  ro.observe(element);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

function getTruncationSnapshot(element: HTMLSpanElement | null): boolean {
  if (!element) return false;
  return element.scrollWidth > element.clientWidth;
}

function useIsElementTruncated(element: HTMLSpanElement | null): boolean {
  return React.useSyncExternalStore(
    React.useCallback(
      (onStoreChange) => {
        if (!element) return () => {};
        return subscribeToTruncation(element, onStoreChange);
      },
      [element],
    ),
    () => getTruncationSnapshot(element),
    () => false,
  );
}

/**
 * Viser tekst med truncate. Hvis teksten er avkortet eller over LIKELY_TRUNCATED_LENGTH,
 * vises en tooltip med full tekst ved hover.
 * Brukes i drift-sidebar, MeterFolderTree og lignende trange lister.
 */
export function TruncatedTextWithTooltip({
  text,
  className,
  align = "start",
  tooltipClassName,
}: TruncatedTextWithTooltipProps) {
  const [element, setElement] = React.useState<HTMLSpanElement | null>(null);
  const isTruncated = useIsElementTruncated(element);

  const showTooltip = isTruncated || text.length > LIKELY_TRUNCATED_LENGTH;
  const content = (
    <span ref={setElement} className={className}>
      {text}
    </span>
  );

  if (!showTooltip) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right" align={align} className={tooltipClassName}>
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
