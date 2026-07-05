"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SD_ANLEGG_BTN_PRESS,
  SD_ANLEGG_OVERVIEW_WIDGET,
  SD_ANLEGG_OVERVIEW_WIDGET_BODY,
  SD_ANLEGG_OVERVIEW_WIDGET_FOOTER,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type WidgetProps = {
  title: string;
  titleId: string;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  isRefreshing?: boolean;
  children: ReactNode;
  footer?: {
    href: string;
    label: string;
  };
  footerAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
};

export function SdAnleggOverviewWidget({
  title,
  titleId,
  subtitle,
  icon: Icon,
  iconClassName,
  isRefreshing = false,
  children,
  footer,
  footerAction,
  className,
}: WidgetProps) {
  return (
    <section
      className={cn(SD_ANLEGG_OVERVIEW_WIDGET, className)}
      aria-labelledby={titleId}
      aria-busy={isRefreshing || undefined}
    >
      <div className={cn(SD_ANLEGG_OVERVIEW_WIDGET_BODY, "relative")}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex justify-center py-0.5 sm:py-1"
          aria-hidden={!isRefreshing}
        >
          <div
            className={cn(
              "h-0.5 w-16 rounded-full bg-muted-foreground/12 sm:w-20",
              isRefreshing
                ? "opacity-100 motion-safe:animate-pulse"
                : "opacity-0",
            )}
          />
        </div>
        {isRefreshing ? (
          <span className="sr-only">Oppdaterer målinger</span>
        ) : null}
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <h3
              id={titleId}
              className="text-[0.9375rem] font-semibold leading-snug text-foreground"
            >
              {title}
            </h3>
            {subtitle ? (
              <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>
            ) : null}
          </div>
          {Icon ? (
            <Icon
              className={cn(
                "size-4 shrink-0 text-muted-foreground",
                iconClassName,
              )}
              aria-hidden
            />
          ) : null}
        </div>

        {children}

        {footer ? (
          <div className={SD_ANLEGG_OVERVIEW_WIDGET_FOOTER}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn("h-8 gap-1 px-3 text-xs", SD_ANLEGG_BTN_PRESS)}
              asChild
            >
              <Link href={footer.href} prefetch scroll={false}>
                {footer.label}
                <ChevronRight className="size-3.5 opacity-70" aria-hidden />
              </Link>
            </Button>
          </div>
        ) : footerAction ? (
          <div className={SD_ANLEGG_OVERVIEW_WIDGET_FOOTER}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn("h-8 gap-1 px-3 text-xs", SD_ANLEGG_BTN_PRESS)}
              onClick={footerAction.onClick}
            >
              {footerAction.label}
              <ChevronRight className="size-3.5 opacity-70" aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
