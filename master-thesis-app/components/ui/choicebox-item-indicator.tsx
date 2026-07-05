"use client";

import { cn } from "@/lib/utils";
import { CircleIcon } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

export type ChoiceboxItemIndicatorProps = ComponentProps<
  typeof RadioGroupPrimitive.Indicator
>;
export const ChoiceboxItemIndicator = ({
  className,
  ...props
}: ChoiceboxItemIndicatorProps) => (
  <RadioGroupPrimitive.Indicator asChild {...props}>
    <CircleIcon className={cn("size-2 fill-primary", className)} />
  </RadioGroupPrimitive.Indicator>
);
