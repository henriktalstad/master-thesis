"use client";

import { cn } from "@/lib/utils";
import { RadioGroup } from "@/components/ui/radio-group";
import type { ComponentProps } from "react";

export {
  ChoiceboxItem,
  ChoiceboxItemContent,
  ChoiceboxItemDescription,
  ChoiceboxItemHeader,
  ChoiceboxItemTitle,
  type ChoiceboxItemContentProps,
  type ChoiceboxItemDescriptionProps,
  type ChoiceboxItemHeaderProps,
  type ChoiceboxItemProps,
  type ChoiceboxItemTitleProps,
} from "@/components/ui/choicebox-item";
export {
  ChoiceboxItemIndicator,
  type ChoiceboxItemIndicatorProps,
} from "@/components/ui/choicebox-item-indicator";
export {
  ChoiceboxItemSubtitle,
  type ChoiceboxItemSubtitleProps,
} from "@/components/ui/choicebox-item-subtitle";

export type ChoiceboxProps = ComponentProps<typeof RadioGroup>;
export const Choicebox = ({ className, ...props }: ChoiceboxProps) => (
  <RadioGroup className={cn("w-full", className)} {...props} />
);
