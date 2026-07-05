"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import { IntegrationNavLink } from "./integration-nav-link";
import { IntegrationNavLinkPendingIcon } from "./integration-nav-link-pending-icon";

export function IntegrationNavButton({
  href,
  children,
  className,
  variant = "outline",
  size = "sm",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      asChild
      className={cn("text-sm", className)}
    >
      <IntegrationNavLink href={href} className="inline-flex items-center gap-2">
        <IntegrationNavLinkPendingIcon />
        {children}
      </IntegrationNavLink>
    </Button>
  );
}
