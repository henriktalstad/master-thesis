"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type PageShellProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Ekstra klasser på undertittel-wrapper (f.eks. `max-w-none` for full bredde under tittel). */
  subtitleClassName?: string;
  /** F.eks. tilbake-knapp — plasseres til venstre for tittel/undertittel (kun når `headerSlot` ikke er satt). */
  headerLeadingSlot?: React.ReactNode;
  headerSlot?: React.ReactNode;
  toolbarSlot?: React.ReactNode;
  /** Klasses på verktøylinje-wrapper (f.eks. `2xl:hidden` for å fjerne luft når innholdet kun vises på smalere skjerm) */
  toolbarClassName?: string;
  /** Overstyr margin under header (f.eks. tettere flyt-sider) */
  headerSectionClassName?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidth?: "lg" | "xl" | "2xl" | "full" | "responsive";
  stickyToolbar?: boolean;
};

export function PageShell({
  title,
  subtitle,
  subtitleClassName,
  headerLeadingSlot,
  headerSlot,
  toolbarSlot,
  toolbarClassName,
  headerSectionClassName,
  children,
  className,
  contentClassName,
  maxWidth = "2xl",
  stickyToolbar = false,
}: PageShellProps) {
  const maxW =
    maxWidth === "full"
      ? "max-w-full"
      : maxWidth === "responsive"
        ? "max-w-screen-lg xl:max-w-screen-xl 2xl:max-w-screen-2xl"
        : maxWidth === "lg"
          ? "max-w-screen-lg"
          : maxWidth === "xl"
            ? "max-w-screen-xl"
            : "max-w-screen-2xl";

  return (
    <div className={cn("page-shell w-full min-w-0 max-w-full", className)}>
      <style>{`
        :root {
          /* Horisontal gutter — progressiv med viewport */
          --shell-gutter-x: clamp(16px, 3.5vw, 40px);
          /* Vertikal luft for PageShell (topp/bunn); tidligere kun definert, ikke brukt */
          --shell-gutter-y: clamp(18px, 2.8vw, 28px);
        }
        .page-shell {
          padding-top: var(--shell-gutter-y);
          /* Ekstra bunn mot OS home-indikator / dock; minst like mye som topp */
          padding-bottom: max(
            var(--shell-gutter-y),
            calc(env(safe-area-inset-bottom, 0px) + 1rem)
          );
        }
        [data-sidebar="expanded"] .page-shell {
          --shell-gutter-x: clamp(24px, 4.5vw, 56px);
          --shell-gutter-y: clamp(20px, 3vw, 32px);
        }
        @media (min-width: 640px) {
          :root {
            --shell-gutter-y: clamp(20px, 3vw, 34px);
          }
        }
        @media (min-width: 768px) {
          :root {
            --shell-gutter-y: clamp(22px, 3.2vw, 38px);
          }
          [data-sidebar="expanded"] .page-shell {
            --shell-gutter-y: clamp(24px, 3.4vw, 40px);
          }
        }
        @media (min-width: 1280px) {
          :root {
            --shell-gutter-x: clamp(24px, 5vw, 64px);
            --shell-gutter-y: clamp(26px, 3.5vw, 44px);
          }
          [data-sidebar="expanded"] .page-shell {
            --shell-gutter-x: clamp(28px, 5.5vw, 72px);
            --shell-gutter-y: clamp(28px, 3.6vw, 48px);
          }
        }
        @media (min-width: 1536px) {
          :root {
            --shell-gutter-x: clamp(32px, 6vw, 96px);
            --shell-gutter-y: clamp(30px, 3.8vw, 52px);
          }
          [data-sidebar="expanded"] .page-shell {
            --shell-gutter-x: clamp(36px, 6.5vw, 112px);
            --shell-gutter-y: clamp(32px, 4vw, 56px);
          }
        }
        /* Konsistent horisontal gutter styrt av variabel – funker på alle views */
        .page-shell .ps-container {
          padding-left: var(--shell-gutter-x);
          padding-right: var(--shell-gutter-x);
        }
        .page-shell .ps-toolbar {
          position: relative;
        }
        @media (min-width: 768px) {
          .page-shell .ps-toolbar.sticky {
            position: sticky;
            top: var(--header-height, 64px);
            z-index: 5;
            background: var(--background);
            border-bottom: 1px solid rgba(0, 0, 0, 0.05);
          }
        }
      `}</style>
      <div className={cn("ps-container mx-auto w-full min-w-0", maxW)}>
        {title || headerSlot || headerLeadingSlot ? (
          <div className={cn("mb-5 sm:mb-6 md:mb-8", headerSectionClassName)}>
            {headerSlot ?? (
              <div
                className={cn(
                  "flex min-w-0 items-start gap-3 sm:gap-4",
                  headerLeadingSlot && "md:gap-5",
                )}
              >
                {headerLeadingSlot ? (
                  <div className="shrink-0 pt-0.5">{headerLeadingSlot}</div>
                ) : null}
                <div className="min-w-0 flex-1">
                  {typeof title !== "undefined" && (
                    <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xl font-semibold leading-tight tracking-tight">
                      {title}
                    </h1>
                  )}
                  {subtitle ? (
                    <div
                      className={cn(
                        "mt-1 w-full min-w-0 max-w-prose text-pretty text-sm text-muted-foreground",
                        subtitleClassName,
                      )}
                    >
                      {subtitle}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
      {toolbarSlot ? (
        <div
          className={cn(
            "ps-toolbar",
            stickyToolbar && "sticky",
            toolbarClassName,
          )}
        >
          <div
            className={cn(
              "ps-container mx-auto w-full min-w-0 py-3 md:py-4",
              maxW,
            )}
          >
            {toolbarSlot}
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "ps-container mx-auto w-full min-w-0 max-w-full",
          maxW,
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
