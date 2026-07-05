"use client";

import { useLinkStatus } from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function IntegrationNavLinkPendingIcon({
  className,
}: {
  className?: string;
}) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <Spinner
      variant="circle"
      size={14}
      decorative
      className={cn("shrink-0 text-current", className)}
    />
  );
}
