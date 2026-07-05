"use client";

import Link, { type LinkProps } from "next/link";
import { useNavigationProgress } from "@/contexts/navigation-progress-context";
import type { ComponentProps, MouseEvent, PointerEvent } from "react";

function isModifiedClick(e: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}

/** Felles prefetch + `startNavigation(href)` for interne plattform-lenker. */
export function usePlattformNavLinkHandlers(href: string) {
  const navigationProgress = useNavigationProgress();

  const beginNavigation = (
    e: PointerEvent<HTMLAnchorElement> | MouseEvent<HTMLAnchorElement>,
  ) => {
    if (isModifiedClick(e)) return;
    navigationProgress?.startNavigation(href);
  };

  return { beginNavigation };
}

type PlattformNavLinkProps = Omit<ComponentProps<typeof Link>, "href"> &
  LinkProps & {
    href: string;
  };

/**
 * Standard intern navigasjonslenke: prefetch, umiddelbar pending via pointerdown,
 * og samme-side-sjekk via `startNavigation(href)`.
 */
export function PlattformNavLink({
  href,
  prefetch = true,
  onPointerDown,
  ...props
}: PlattformNavLinkProps) {
  const { beginNavigation } = usePlattformNavLinkHandlers(href);

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onPointerDown={(e) => {
        beginNavigation(e);
        onPointerDown?.(e);
      }}
      {...props}
    />
  );
}
