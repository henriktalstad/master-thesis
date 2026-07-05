"use client";

import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export type ChoiceboxItemSubtitleProps = HTMLAttributes<HTMLSpanElement>;
export const ChoiceboxItemSubtitle = ({
  className,
  ...props
}: ChoiceboxItemSubtitleProps) => (
  <span
    className={cn("font-normal text-muted-foreground text-xs", className)}
    {...props}
  />
);
