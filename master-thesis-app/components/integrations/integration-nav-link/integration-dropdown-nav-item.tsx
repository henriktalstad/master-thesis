"use client";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { IntegrationNavLink } from "./integration-nav-link";

export function IntegrationDropdownNavItem({
  href,
  integrationId,
  onStartLoadingAction,
  children,
  className,
}: {
  href: string;
  integrationId?: string;
  onStartLoadingAction?: (integrationId: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
      <IntegrationNavLink
        href={href}
        className={cn(
          "flex cursor-pointer items-center gap-2 outline-hidden",
          className,
        )}
        onClick={() => {
          if (integrationId != null) {
            onStartLoadingAction?.(integrationId);
          }
        }}
      >
        {children}
      </IntegrationNavLink>
    </DropdownMenuItem>
  );
}
