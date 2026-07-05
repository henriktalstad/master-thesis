"use client";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

export type ChoiceboxItemProps = RadioGroupPrimitive.RadioGroupItemProps;
export const ChoiceboxItem = ({
  className,
  children,
  ...props
}: ChoiceboxItemProps) => (
  <RadioGroupPrimitive.Item
    asChild
    className={cn(
      "text-left",
      'data-[state="checked"]:border-primary',
      'data-[state="checked"]:bg-primary-foreground',
    )}
    {...props}
  >
    <Card
      className={cn(
        "flex cursor-pointer flex-row items-start justify-between rounded-md p-4 shadow-none transition-all",
        "border border-border bg-card text-foreground",
        "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary/5",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </Card>
  </RadioGroupPrimitive.Item>
);

export type ChoiceboxItemHeaderProps = ComponentProps<typeof CardHeader>;
export const ChoiceboxItemHeader = ({
  className,
  ...props
}: ComponentProps<typeof CardHeader>) => (
  <CardHeader className={cn("flex-1 p-0", className)} {...props} />
);

export type ChoiceboxItemTitleProps = ComponentProps<typeof CardTitle>;
export const ChoiceboxItemTitle = ({
  className,
  ...props
}: ChoiceboxItemTitleProps) => (
  <CardTitle
    className={cn("flex items-center gap-2 text-sm text-foreground", className)}
    {...props}
  />
);

export type ChoiceboxItemDescriptionProps = ComponentProps<
  typeof CardDescription
>;
export const ChoiceboxItemDescription = ({
  className,
  ...props
}: ChoiceboxItemDescriptionProps) => (
  <CardDescription className={cn("text-sm", className)} {...props} />
);

export type ChoiceboxItemContentProps = ComponentProps<typeof CardContent>;
export const ChoiceboxItemContent = ({
  className,
  ...props
}: ChoiceboxItemContentProps) => (
  <CardContent
    className={cn(
      "flex aspect-square size-4 shrink-0 items-center justify-center rounded-full border border-input p-0 text-primary shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
      className,
    )}
    {...props}
  />
);
