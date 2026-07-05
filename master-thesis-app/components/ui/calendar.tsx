"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";

function Calendar({
  className,
  classNames: userClassNames,
  showOutsideDays = true,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames();
  const rangeModeForCells = props.mode === "range";

  const baseClassNames: Record<string, string> = {
    root: cn("w-fit", defaultClassNames.root),
    months: cn(
      "relative flex flex-col gap-4 sm:flex-row sm:gap-2",
      defaultClassNames.months,
    ),
    month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
    month_caption: cn(
      "relative z-0 mb-1 flex h-9 w-full items-center justify-center px-8 pt-1",
      defaultClassNames.month_caption,
    ),
    caption_label: cn("text-sm font-medium", defaultClassNames.caption_label),
    nav: cn(
      "absolute inset-x-0 top-0 z-10 flex w-full items-center justify-between gap-1",
      defaultClassNames.nav,
    ),
    button_previous: cn(
      buttonVariants({ variant: "outline" }),
      "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
      defaultClassNames.button_previous,
    ),
    button_next: cn(
      buttonVariants({ variant: "outline" }),
      "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
      defaultClassNames.button_next,
    ),
    month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
    weekdays: cn("flex", defaultClassNames.weekdays),
    weekday: cn(
      "w-8 rounded-md text-[0.8rem] font-normal text-muted-foreground",
      defaultClassNames.weekday,
    ),
    week: cn("mt-2 flex w-full", defaultClassNames.week),
    /**
     * I range-modus: ikke legg accent på hele cellen (gir «klaffete» lavendel bak
     * knappene). La start/slutt/midt styre bakgrunn med lesbar tekst.
     */
    day: cn(
      "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
      rangeModeForCells
        ? "[&:has([aria-selected])]:bg-transparent"
        : "[&:has([aria-selected])]:bg-accent",
      rangeModeForCells
        ? "[&:has([aria-selected].day-range-end)]:rounded-r-md [&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
        : "[&:has([aria-selected])]:rounded-md",
      defaultClassNames.day,
    ),
    day_button: cn(
      buttonVariants({ variant: "ghost" }),
      "size-8 p-0 font-normal aria-selected:opacity-100",
      defaultClassNames.day_button,
    ),
    range_start: cn(
      "day-range-start rounded-md aria-selected:bg-primary aria-selected:text-primary-foreground",
      defaultClassNames.range_start,
    ),
    range_end: cn(
      "day-range-end rounded-md aria-selected:bg-primary aria-selected:text-primary-foreground",
      defaultClassNames.range_end,
    ),
    range_middle: cn(
      "rounded-none bg-primary/10 text-foreground aria-selected:bg-primary/16 aria-selected:text-foreground dark:bg-primary/15 dark:aria-selected:bg-primary/22",
      defaultClassNames.range_middle,
    ),
    selected: cn(
      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
      defaultClassNames.selected,
    ),
    /** I dag: diskret ring i periodevalg, slipper forveksling med valgt intervall */
    today: cn(
      rangeModeForCells
        ? "bg-transparent font-medium text-foreground ring-1 ring-inset ring-border/80 rounded-md aria-selected:ring-0"
        : "bg-accent text-accent-foreground",
      defaultClassNames.today,
    ),
    outside: cn(
      "day-outside text-muted-foreground aria-selected:text-muted-foreground",
      defaultClassNames.outside,
    ),
    disabled: cn(
      "text-muted-foreground opacity-50",
      defaultClassNames.disabled,
    ),
    hidden: cn("invisible", defaultClassNames.hidden),
  };

  const mergedClassNames: Record<string, string> = { ...baseClassNames };
  if (userClassNames) {
    for (const [key, value] of Object.entries(userClassNames)) {
      if (value == null || value === "") continue;
      const base = baseClassNames[key];
      mergedClassNames[key] = base ? cn(base, value) : value;
    }
  }

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={
        mergedClassNames as React.ComponentProps<typeof DayPicker>["classNames"]
      }
      components={{
        Chevron: ({
          className: chevronClassName,
          orientation,
          ...chevronProps
        }) => {
          if (orientation === "left") {
            return (
              <ChevronLeft
                className={cn("size-4", chevronClassName)}
                {...chevronProps}
              />
            );
          }
          if (orientation === "right") {
            return (
              <ChevronRight
                className={cn("size-4", chevronClassName)}
                {...chevronProps}
              />
            );
          }
          if (orientation === "up") {
            return (
              <ChevronUp
                className={cn("size-4", chevronClassName)}
                {...chevronProps}
              />
            );
          }
          return (
            <ChevronDown
              className={cn("size-4", chevronClassName)}
              {...chevronProps}
            />
          );
        },
        ...components,
      }}
      {...props}
    />
  );
}

export { Calendar };
