"use client";

import { PlattformNavLink } from "@/components/navigation/plattform-nav-link";
import type { ComponentProps, ReactNode } from "react";

type IntegrationNavLinkProps = Omit<
  ComponentProps<typeof PlattformNavLink>,
  "href"
> & {
  href: string;
  children: ReactNode;
};

export function IntegrationNavLink({
  href,
  children,
  ...props
}: IntegrationNavLinkProps) {
  return (
    <PlattformNavLink href={href} {...props}>
      {children}
    </PlattformNavLink>
  );
}
