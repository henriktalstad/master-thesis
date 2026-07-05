"use client";

import * as React from "react";
import { HoverCard as HoverCardPrimitive } from "radix-ui";

export { HoverCardTrigger } from "@/components/ui/hover-card-trigger";
export { HoverCardContent } from "@/components/ui/hover-card-content";

export function HoverCard({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />;
}
