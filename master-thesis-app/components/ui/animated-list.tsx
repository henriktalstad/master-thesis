"use client";

import * as React from "react";
import { useEffectEvent } from "react";
import { cn } from "@/lib/utils";
import { AnimatedListGradients } from "@/components/ui/animated-list-gradients";
import { AnimatedListRenderedItem } from "@/components/ui/animated-list-rendered-item";
import { useAnimatedListPresence } from "@/components/ui/use-animated-list-presence";

export { AnimatedItem } from "@/components/ui/animated-list-item";

type AnimatedListProps = {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  enterClassName?: string;
  exitClassName?: string;
  enableArrowNavigation?: boolean;
  initialSelectedIndex?: number;
  showGradients?: boolean;
  displayScrollbar?: boolean;
  onItemSelect?: (index: number) => void;
  autoFocusOnMount?: boolean;
  listClassName?: string;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
};

export function AnimatedList({
  children,
  className,
  duration = 300,
  enterClassName = "animate-in fade-in-50 slide-in-from-top-2",
  exitClassName = "animate-out fade-out-50 slide-out-to-top-2",
  enableArrowNavigation = true,
  initialSelectedIndex = -1,
  showGradients = false,
  displayScrollbar = true,
  onItemSelect,
  autoFocusOnMount = false,
  listClassName,
  scrollContainerRef,
}: AnimatedListProps) {
  const childArray = React.Children.toArray(children);
  const keys = childArray.flatMap((c) =>
    React.isValidElement(c) && c.key != null && c.key !== ""
      ? [String(c.key)]
      : [],
  );

  const { presentKeys, exiting } = useAnimatedListPresence(keys, duration);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [selectedIndex, setSelectedIndex] =
    React.useState<number>(initialSelectedIndex);
  const [topGradientOpacity, setTopGradientOpacity] = React.useState(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = React.useState(1);
  const keysSignature = keys.join("|");

  const scrollItemIntoView = React.useCallback(
    (index: number) => {
      if (!enableArrowNavigation || index < 0 || !listRef.current) return;
      const container = listRef.current;
      const sel = container.querySelector<HTMLElement>(
        `[data-index="${index}"]`,
      );
      if (!sel) return;
      try {
        const resolveScrollable = (node: HTMLElement | null): HTMLElement => {
          if (scrollContainerRef?.current) {
            return scrollContainerRef.current as HTMLElement;
          }
          let current: HTMLElement | null = node?.parentElement || null;
          while (current) {
            const style = window.getComputedStyle(current);
            const oy = style.overflowY;
            if (oy === "auto" || oy === "scroll") return current;
            current = current.parentElement;
          }
          return container;
        };
        const scrollEl = resolveScrollable(sel);
        const extra = 50;
        const st = scrollEl.scrollTop;
        const ch = scrollEl.clientHeight;
        const top =
          sel.getBoundingClientRect().top -
          scrollEl.getBoundingClientRect().top +
          scrollEl.scrollTop;
        const bottom = top + sel.offsetHeight;
        if (top < st + extra) {
          scrollEl.scrollTo({
            top: Math.max(top - extra, 0),
            behavior: "smooth",
          });
        } else if (bottom > st + ch - extra) {
          scrollEl.scrollTo({ top: bottom - ch + extra, behavior: "smooth" });
        }
      } catch {}
    },
    [enableArrowNavigation, scrollContainerRef],
  );

  const focusListItem = React.useCallback((index: number) => {
    listRef.current
      ?.querySelector<HTMLElement>(`#animated-list-item-${index}`)
      ?.focus();
  }, []);

  const hasInitializedListRef = React.useRef(false);
  const assignListRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node;
      if (!node || hasInitializedListRef.current) return;

      hasInitializedListRef.current = true;
      if (enableArrowNavigation && autoFocusOnMount) {
        requestAnimationFrame(() => {
          focusListItem(initialSelectedIndex >= 0 ? initialSelectedIndex : 0);
        });
      }

      if (enableArrowNavigation && initialSelectedIndex >= 0) {
        scrollItemIntoView(initialSelectedIndex);
      }
    },
    [
      autoFocusOnMount,
      enableArrowNavigation,
      focusListItem,
      initialSelectedIndex,
      scrollItemIntoView,
    ],
  );

  const updateGradientOpacity = React.useCallback((el: HTMLElement) => {
    const { scrollTop, scrollHeight, clientHeight } = el;
    setTopGradientOpacity(Math.min(scrollTop / 50, 1));
    const bottomDistance = scrollHeight - (scrollTop + clientHeight);
    setBottomGradientOpacity(
      scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1),
    );
  }, []);

  const syncGradientOpacity = useEffectEvent((el: HTMLElement) => {
    updateGradientOpacity(el);
  });

  React.useLayoutEffect(() => {
    if (!showGradients) return;
    const el = listRef.current;
    if (!el) return;
    syncGradientOpacity(el);
  }, [showGradients, keysSignature]);

  React.useEffect(() => {
    if (!showGradients) return;
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => syncGradientOpacity(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [showGradients]);

  const handleItemKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (!enableArrowNavigation) return;

      const itemCount = presentKeys.size;
      if (itemCount === 0) return;

      let nextIndex = index;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        nextIndex = Math.min(index + 1, itemCount - 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        nextIndex = Math.max(index - 1, 0);
      } else if (event.key === "Enter") {
        event.preventDefault();
        onItemSelect?.(index);
        return;
      } else {
        return;
      }

      if (nextIndex === index) return;
      setSelectedIndex(nextIndex);
      scrollItemIntoView(nextIndex);
      focusListItem(nextIndex);
    },
    [
      enableArrowNavigation,
      focusListItem,
      onItemSelect,
      presentKeys.size,
      scrollItemIntoView,
    ],
  );

  const rendered = React.useMemo(() => {
    const childByKey = new Map<string, React.ReactNode>();
    childArray.forEach((node) => {
      if (!React.isValidElement(node)) return;
      const key = String(node.key ?? "");
      childByKey.set(key, node);
    });

    return Array.from(presentKeys).flatMap((k, index) => {
      const original = childByKey.get(k);
      if (!original) return [];
      return [
        <AnimatedListRenderedItem
          key={k}
          itemKey={k}
          index={index}
          original={original}
          isExiting={exiting.has(k)}
          duration={duration}
          enterClassName={enterClassName}
          exitClassName={exitClassName}
          enableArrowNavigation={enableArrowNavigation}
          onItemSelect={onItemSelect}
          selectedIndex={selectedIndex}
          scrollItemIntoView={scrollItemIntoView}
          onItemHover={setSelectedIndex}
          handleItemKeyDown={handleItemKeyDown}
        />,
      ];
    });
  }, [
    childArray,
    presentKeys,
    exiting,
    duration,
    enterClassName,
    exitClassName,
    enableArrowNavigation,
    onItemSelect,
    selectedIndex,
    scrollItemIntoView,
    handleItemKeyDown,
  ]);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={assignListRef}
        className={cn(
          "w-full",
          listClassName,
          displayScrollbar ? undefined : "no-scrollbar",
        )}
      >
        {rendered}
      </div>
      {showGradients ? (
        <AnimatedListGradients
          topGradientOpacity={topGradientOpacity}
          bottomGradientOpacity={bottomGradientOpacity}
        />
      ) : null}
    </div>
  );
}

export default AnimatedList;
