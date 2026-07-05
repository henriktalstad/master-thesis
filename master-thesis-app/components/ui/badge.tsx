"use client";

import * as React from "react";
import type { VariantProps } from "class-variance-authority";
import { Slot as SlotPrimitive } from "radix-ui";

import { badgeVariants } from "@/components/ui/badge-variants";
import { cn } from "@/lib/utils";

const Slot = SlotPrimitive.Root;

function Badge({
  className,
  variant,
  size,
  shape,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, shape }), className)}
      {...props}
    />
  );
}

export { Badge };
