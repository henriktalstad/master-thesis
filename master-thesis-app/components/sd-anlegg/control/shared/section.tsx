"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { SD_ANLEGG_BTN_PRESS, SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  title: string;
  description?: string;
  badge?: ReactNode;
  className?: string;
};

export function SdAnleggControlSectionHeader({
  title,
  description,
  badge,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {badge}
      </div>
      {description ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

type CollapsibleProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  badge?: string;
  children: ReactNode;
  className?: string;
};

export function SdAnleggControlCollapsibleSection({
  title,
  description,
  defaultOpen = false,
  badge,
  children,
  className,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className={cn(SD_ANLEGG_CARD, "overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-start justify-between gap-3 border-b border-border/60 px-4 py-3 text-left transition-[background-color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/30 sm:px-5",
          SD_ANLEGG_BTN_PRESS,
        )}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {badge ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {badge}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={panelId} className="p-4 sm:p-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}
