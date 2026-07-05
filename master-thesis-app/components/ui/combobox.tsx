"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";

export type ComboboxOption = { value: string; label: string };

export function Combobox({
  value,
  onChangeAction,
  options,
  placeholder,
  className,
  buttonClassName,
  disabled,
  modal = true,
  id,
}: {
  value?: string;
  onChangeAction: (v: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  modal?: boolean;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const listboxId = React.useId();
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          size="sm"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listboxId : undefined}
          aria-label={placeholder ?? "Velg"}
          className={cn(
            "h-8 min-w-28 justify-between",
            selected ? "text-foreground" : "text-muted-foreground",
            buttonClassName,
          )}
        >
          <span className="truncate">
            {selected ? selected.label : placeholder || "Velg…"}
          </span>
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("p-0 w-[280px] max-h-72", className)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput
            placeholder={
              placeholder ? `Søk ${placeholder.toLowerCase()}…` : "Søk…"
            }
          />
          <CommandList id={listboxId} className="max-h-60 overflow-auto">
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onChangeAction(opt.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === opt.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
