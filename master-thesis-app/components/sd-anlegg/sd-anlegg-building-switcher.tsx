"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InfraspawnBuildingNavItem } from "@/lib/infraspawn/building-nav-items";
import { SD_ANLEGG_INDEX_SEARCH_MIN } from "@/lib/sd-anlegg/constants";
import { sdAnleggHrefForBuildingSwitch } from "@/lib/sd-anlegg/anleggsenhet-routes";
import { cn } from "@/lib/utils";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";

type Props = {
  buildings: ReadonlyArray<InfraspawnBuildingNavItem>;
  currentSlug: string;
  currentLabel: string;
};

export function SdAnleggBuildingSwitcher({
  buildings,
  currentSlug,
  currentLabel,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const listboxId = useId();

  const navigateToBuilding = (nextSlug: string) => {
    if (nextSlug === currentSlug) return;
    const href = sdAnleggHrefForBuildingSwitch(window.location.pathname, nextSlug);
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  };

  if (buildings.length < SD_ANLEGG_INDEX_SEARCH_MIN) {
    return (
      <div className="min-w-0 max-w-full">
        <label htmlFor="sd-anlegg-building-select" className="sr-only">
          Velg bygg
        </label>
        <Select
          value={currentSlug}
          onValueChange={navigateToBuilding}
          disabled={isPending}
        >
          <SelectTrigger
            id="sd-anlegg-building-select"
            className={cn(
              "h-auto min-h-10 w-full max-w-full touch-manipulation border-0 bg-transparent px-0 py-0 text-xl font-semibold tracking-tight shadow-none transition-transform duration-150 ease-out focus:ring-0 focus:ring-offset-0 data-[placeholder]:text-foreground sm:text-2xl",
              SD_ANLEGG_BTN_PRESS,
            )}
          >
            <SelectValue>{currentLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {buildings.map((building) => (
              <SelectItem key={building.buildingSlug} value={building.buildingSlug}>
                {building.buildingName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listboxId : undefined}
          aria-label="Velg bygg"
          disabled={isPending}
          className={cn(
            "h-auto min-h-10 w-full max-w-full justify-between gap-2 px-0 text-left font-semibold hover:bg-transparent",
            SD_ANLEGG_BTN_PRESS,
          )}
        >
          <span className="truncate text-xl tracking-tight sm:text-2xl">
            {currentLabel}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,24rem)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Søk bygg …" />
          <CommandList id={listboxId}>
            <CommandEmpty>Ingen treff.</CommandEmpty>
            <CommandGroup heading="Bygg">
              {buildings.map((building) => (
                <CommandItem
                  key={building.buildingSlug}
                  value={building.buildingName}
                  onSelect={() => {
                    navigateToBuilding(building.buildingSlug);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4 shrink-0",
                      currentSlug === building.buildingSlug
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                    aria-hidden
                  />
                  {building.buildingName}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
