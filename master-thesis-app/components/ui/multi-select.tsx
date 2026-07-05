"use client";

import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { Badge } from "@/components/ui/badge";

type MultiSelectContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  selectedValues: Set<string>;
  toggleValue: (value: string) => void;
  items: Map<string, ReactNode>;
  onItemAdded: (value: string, label: ReactNode) => void;
};
const MultiSelectContext = createContext<MultiSelectContextType | null>(null);

export function MultiSelect({
  children,
  values,
  defaultValues,
  onValuesChange,
}: {
  children: ReactNode;
  values?: string[];
  defaultValues?: string[];
  onValuesChange?: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedValues, setSelectedValues] = useState(
    new Set<string>(values ?? defaultValues),
  );
  const [items, setItems] = useState<Map<string, ReactNode>>(new Map());

  const contextSelectedValues = useMemo(() => {
    if (values) return new Set(values);
    return selectedValues;
  }, [selectedValues, values]);

  const toggleValue = useCallback(
    (value: string) => {
      const getNewSet = (prev: Set<string>) => {
        const newSet = new Set(prev);
        if (newSet.has(value)) {
          newSet.delete(value);
        } else {
          newSet.add(value);
        }
        return newSet;
      };

      const currentSet = values ? new Set(values) : selectedValues;
      const newSet = getNewSet(currentSet);

      setSelectedValues(newSet);
      onValuesChange?.([...newSet]);
    },
    [values, selectedValues, onValuesChange],
  );

  const onItemAdded = useCallback((value: string, label: ReactNode) => {
    setItems((prev) => {
      if (prev.get(value) === label) return prev;
      return new Map(prev).set(value, label);
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      open,
      setOpen,
      selectedValues: contextSelectedValues,
      toggleValue,
      items,
      onItemAdded,
    }),
    [
      open,
      contextSelectedValues,
      toggleValue,
      items,
      onItemAdded,
    ],
  );

  return (
    <MultiSelectContext value={contextValue}>
      <Popover open={open} onOpenChange={setOpen}>
        {children}
      </Popover>
    </MultiSelectContext>
  );
}

export function MultiSelectTrigger({
  className,
  children,
  ...props
}: {
  className?: string;
  children?: ReactNode;
} & ComponentPropsWithoutRef<typeof Button>) {
  const { open } = useMultiSelectContext();

  return (
    <PopoverTrigger asChild>
      <Button
        {...props}
        variant={props.variant ?? "outline"}
        role={props.role ?? "combobox"}
        aria-expanded={props["aria-expanded"] ?? open}
        className={cn(
          "flex h-auto min-h-9 w-fit items-center justify-between gap-2 overflow-hidden rounded-md border border-input bg-background hover:bg-muted/60 px-3 py-1.5 text-sm whitespace-nowrap shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
          className,
        )}
      >
        {children}
        <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
  );
}

export function MultiSelectValue({
  placeholder,
  clickToRemove = true,
  className,
  overflowBehavior = "wrap-when-open",
  ...props
}: {
  placeholder?: string;
  clickToRemove?: boolean;
  overflowBehavior?: "wrap" | "wrap-when-open" | "cutoff";
} & Omit<ComponentPropsWithoutRef<"div">, "children">) {
  const { selectedValues, toggleValue, items, open } = useMultiSelectContext();
  const [overflowAmount, setOverflowAmount] = useState(0);
  const valueRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Set<HTMLElement>>(new Set());

  const clearTrackedItemDisplay = useCallback(() => {
    itemsRef.current.forEach((child) => child.style.removeProperty("display"));
  }, []);

  const shouldWrap =
    overflowBehavior === "wrap" ||
    (overflowBehavior === "wrap-when-open" && open);

  useEffect(() => {
    if (!shouldWrap) return;
    clearTrackedItemDisplay();
  }, [shouldWrap, clearTrackedItemDisplay]);

  const checkOverflow = useCallback(() => {
    if (valueRef.current == null) return;

    const containerElement = valueRef.current;
    const overflowElement = overflowRef.current;
    const tracked = itemsRef.current;

    if (overflowElement != null) overflowElement.style.display = "none";
    tracked.forEach((child) => child.style.removeProperty("display"));
    let amount = 0;
    for (let i = tracked.size - 1; i >= 0; i--) {
      const child = [...tracked][i];
      if (containerElement.scrollWidth <= containerElement.clientWidth) {
        break;
      }
      amount = tracked.size - i;
      child.style.display = "none";
      overflowElement?.style.removeProperty("display");
    }
    setOverflowAmount(amount);
  }, []);

  const checkOverflowOnResize = useEffectEvent(checkOverflow);

  useEffect(() => {
    if (valueRef.current == null) return;

    const observer = new ResizeObserver(() => checkOverflowOnResize());
    observer.observe(valueRef.current);

    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => checkOverflowOnResize());
    return () => cancelAnimationFrame(frame);
  }, [selectedValues]);

  if (selectedValues.size === 0 && placeholder) {
    return (
      <span className="font-normal text-muted-foreground">{placeholder}</span>
    );
  }

  return (
    <div
      {...props}
      ref={valueRef}
      className={cn(
        "flex w-full gap-1.5 overflow-hidden",
        shouldWrap && "h-full flex-wrap",
        className,
      )}
    >
      {[...selectedValues].flatMap((value) =>
        items.has(value) ? [
          <Badge
            ref={(el) => {
              if (el == null) return;

              itemsRef.current.add(el);
              return () => {
                itemsRef.current.delete(el);
              };
            }}
            variant="outline"
            className="group flex items-center gap-1"
            key={value}
            onClick={
              clickToRemove
                ? (e) => {
                    e.stopPropagation();
                    toggleValue(value);
                  }
                : undefined
            }
          >
            {items.get(value)}
            {clickToRemove ? (
              <XIcon className="size-2 text-muted-foreground group-hover:text-destructive" />
            ) : null}
          </Badge>,
        ] : [],
      )}
      <Badge
        style={{
          display: overflowAmount > 0 && !shouldWrap ? "block" : "none",
        }}
        variant="outline"
        ref={overflowRef}
      >
        +{overflowAmount}
      </Badge>
    </div>
  );
}

export function MultiSelectContent({
  search = true,
  children,
  ...props
}: {
  search?: boolean | { placeholder?: string; emptyMessage?: string };
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<typeof Command>, "children">) {
  const canSearch = typeof search === "object" ? true : search;

  return (
    <>
      <div style={{ display: "none" }}>
        <Command>
          <CommandList>{children}</CommandList>
        </Command>
      </div>
      <PopoverContent className="min-w-(--radix-popover-trigger-width) p-0 bg-popover text-popover-foreground">
        <Command {...props}>
          {canSearch ? (
            <CommandInput
              placeholder={
                typeof search === "object" ? search.placeholder : undefined
              }
            />
          ) : (
            <span className="sr-only" aria-hidden="true">
              Søk er deaktivert
            </span>
          )}
          <CommandList>
            {canSearch ? (
              <CommandEmpty>
                {typeof search === "object" ? search.emptyMessage : undefined}
              </CommandEmpty>
            ) : null}
            {children}
          </CommandList>
        </Command>
      </PopoverContent>
    </>
  );
}

export function MultiSelectItem({
  value,
  children,
  badgeLabel,
  onSelect,
  searchValue,
  ...props
}: {
  badgeLabel?: ReactNode;
  value: string;
  searchValue?: string;
} & Omit<ComponentPropsWithoutRef<typeof CommandItem>, "value">) {
  const { toggleValue, selectedValues, onItemAdded } = useMultiSelectContext();
  const isSelected = selectedValues.has(value);

  const displayLabel = badgeLabel ?? value;

  useEffect(() => {
    onItemAdded(value, displayLabel);
  }, [value, displayLabel, onItemAdded]);

  const cmdkValue = searchValue ?? value;

  return (
    <CommandItem
      {...props}
      value={cmdkValue}
      onSelect={() => {
        toggleValue(value);
        onSelect?.(value);
      }}
    >
      <CheckIcon
        className={cn("mr-2 size-4", isSelected ? "opacity-100" : "opacity-0")}
      />
      {children}
    </CommandItem>
  );
}

export function MultiSelectGroup(
  props: ComponentPropsWithoutRef<typeof CommandGroup>,
) {
  return <CommandGroup {...props} />;
}

export function MultiSelectSeparator(
  props: ComponentPropsWithoutRef<typeof CommandSeparator>,
) {
  return <CommandSeparator {...props} />;
}

function useMultiSelectContext() {
  const context = use(MultiSelectContext);
  if (context == null) {
    throw new Error(
      "useMultiSelectContext must be used within a MultiSelectContext",
    );
  }
  return context;
}
