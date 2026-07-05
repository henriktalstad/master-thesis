"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type AnimatedListRenderedItemProps = {
  itemKey: string;
  index: number;
  original: React.ReactNode;
  isExiting: boolean;
  duration: number;
  enterClassName: string;
  exitClassName: string;
  enableArrowNavigation: boolean;
  onItemSelect?: (index: number) => void;
  selectedIndex: number;
  scrollItemIntoView: (index: number) => void;
  onItemHover: (index: number) => void;
  handleItemKeyDown: (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => void;
};

export function AnimatedListRenderedItem({
  itemKey,
  index,
  original,
  isExiting,
  duration,
  enterClassName,
  exitClassName,
  enableArrowNavigation,
  onItemSelect,
  selectedIndex,
  scrollItemIntoView,
  onItemHover,
  handleItemKeyDown,
}: AnimatedListRenderedItemProps) {
  const cls = cn(
    isExiting ? exitClassName : enterClassName,
    `duration-${Math.max(150, Math.min(700, duration))}`,
    "ease-out",
  );
  const interactive = enableArrowNavigation || onItemSelect != null;
  const itemStyle = interactive
    ? {
        cursor: enableArrowNavigation ? "pointer" : undefined,
        outline:
          enableArrowNavigation && selectedIndex === index
            ? "2px solid hsl(var(--primary))"
            : undefined,
        outlineOffset:
          enableArrowNavigation && selectedIndex === index ? 2 : undefined,
        background:
          enableArrowNavigation && selectedIndex === index
            ? "hsl(var(--primary)/0.06)"
            : undefined,
      }
    : undefined;

  const handleItemActivate = () => {
    onItemHover(index);
    scrollItemIntoView(index);
    onItemSelect?.(index);
  };

  if (!interactive) {
    return (
      <div
        key={itemKey}
        id={`animated-list-item-${index}`}
        className={cls}
        data-index={index}
      >
        {original}
      </div>
    );
  }

  return (
    <button
      key={itemKey}
      type="button"
      id={`animated-list-item-${index}`}
      className={cn(
        cls,
        "block w-full border-0 bg-transparent p-0 text-left",
      )}
      data-index={index}
      tabIndex={
        enableArrowNavigation
          ? selectedIndex === index || (selectedIndex < 0 && index === 0)
            ? 0
            : -1
          : undefined
      }
      onMouseEnter={() => {
        onItemHover(index);
        scrollItemIntoView(index);
      }}
      onFocus={() => {
        if (enableArrowNavigation) {
          onItemHover(index);
        }
      }}
      onKeyDown={(event) => handleItemKeyDown(event, index)}
      onClick={handleItemActivate}
      style={itemStyle}
      aria-current={
        enableArrowNavigation && selectedIndex === index ? "true" : undefined
      }
    >
      {original}
    </button>
  );
}
