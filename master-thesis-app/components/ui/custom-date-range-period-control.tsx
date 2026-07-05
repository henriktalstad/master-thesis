"use client";

import { useCallback, useState } from "react";
import { nb } from "date-fns/locale";
import { CalendarIcon, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { TZDate } from "react-day-picker";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn, osloYmdFromDate } from "@/lib/utils";
import {
  CUSTOM_DATE_RANGE_OSLO_TZ,
  customDateRangeCalendarClassNames,
  formatChipDateOslo,
  formatYmdRangeTriggerLabel,
  tzDateFromOsloYmd,
  tzMonthFromOsloYmd,
  type CustomDateRangePeriodValue,
} from "@/components/ui/custom-date-range-period-control-shared";

export function CustomDateRangePeriodControl({
  value,
  observationBounds,
  boundsLoading = false,
  scopeReady = true,
  scopeNotReadyMessage = "Velg scope først.",
  emptyBoundsMessage = "Ingen observasjonsdata for valgt scope.",
  popoverTitle = "Tilpasset periode",
  helperText,
  inactiveTriggerLabel = "Velg periode",
  disabled = false,
  triggerClassName,
  onApplyAction,
}: {
  value: CustomDateRangePeriodValue;
  observationBounds: { from: Date; to: Date } | null;
  boundsLoading?: boolean;
  scopeReady?: boolean;
  scopeNotReadyMessage?: string;
  emptyBoundsMessage?: string;
  popoverTitle?: string;
  helperText?: string;
  inactiveTriggerLabel?: string;
  disabled?: boolean;
  triggerClassName?: string;
  onApplyAction: (startYmd: string, endYmd: string) => void;
}) {
  const isActive = value != null;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [calendarRangeDraft, setCalendarRangeDraft] = useState<
    DateRange | undefined
  >(undefined);
  const [calendarMonthOverride, setCalendarMonthOverride] =
    useState<TZDate | null>(null);

  const rangePickStep: "idle" | "need-end" =
    calendarRangeDraft?.from != null && calendarRangeDraft.to == null
      ? "need-end"
      : "idle";

  const calendarMonthAnchorYmd = (() => {
    if (calendarRangeDraft?.from && calendarRangeDraft.to == null) {
      return osloYmdFromDate(calendarRangeDraft.from);
    }
    if (value) return value.endYmd;
    if (observationBounds?.to) {
      return osloYmdFromDate(observationBounds.to);
    }
    return osloYmdFromDate(new Date());
  })();

  const startMonthNav = observationBounds?.from
    ? tzMonthFromOsloYmd(osloYmdFromDate(observationBounds.from))
    : tzMonthFromOsloYmd(calendarMonthAnchorYmd);

  const endMonthNav = observationBounds?.to
    ? tzMonthFromOsloYmd(osloYmdFromDate(observationBounds.to))
    : tzMonthFromOsloYmd(calendarMonthAnchorYmd);

  const calendarMonth =
    calendarMonthOverride ?? tzMonthFromOsloYmd(calendarMonthAnchorYmd);

  const isCalendarDayDisabled = useCallback(
    (date: Date) => {
      if (!observationBounds) return true;
      const dYmd = osloYmdFromDate(date);
      const b0 = osloYmdFromDate(observationBounds.from);
      const b1 = osloYmdFromDate(observationBounds.to);
      return dYmd < b0 || dYmd > b1;
    },
    [observationBounds],
  );

  const chipFromLabel = (() => {
    if (calendarRangeDraft?.from) {
      return formatChipDateOslo(calendarRangeDraft.from);
    }
    if (value) return formatChipDateOslo(tzDateFromOsloYmd(value.startYmd));
    return "—";
  })();

  const chipToLabel = (() => {
    if (calendarRangeDraft?.from && calendarRangeDraft.to == null) {
      return "Velg i kalender";
    }
    if (calendarRangeDraft?.to) {
      return formatChipDateOslo(calendarRangeDraft.to);
    }
    if (value) return formatChipDateOslo(tzDateFromOsloYmd(value.endYmd));
    return "—";
  })();

  const draftComplete = Boolean(
    calendarRangeDraft?.from && calendarRangeDraft?.to,
  );

  const handleOpenChange = (open: boolean) => {
    setPickerOpen(open);
    if (open) {
      if (value) {
        setCalendarRangeDraft({
          from: tzDateFromOsloYmd(value.startYmd),
          to: tzDateFromOsloYmd(value.endYmd),
        });
      } else {
        setCalendarRangeDraft(undefined);
      }
      setCalendarMonthOverride(null);
    }
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      setCalendarRangeDraft(undefined);
      return;
    }
    if (range.to == null) {
      setCalendarRangeDraft({ from: range.from, to: undefined });
      return;
    }
    setCalendarRangeDraft({ from: range.from, to: range.to });
  };

  const handleApply = () => {
    if (!calendarRangeDraft?.from || !calendarRangeDraft.to) {
      toast.error("Velg start- og sluttdato");
      return;
    }
    const startYmd = osloYmdFromDate(calendarRangeDraft.from);
    const endYmd = osloYmdFromDate(calendarRangeDraft.to);
    if (startYmd > endYmd) {
      toast.error("Velg en gyldig periode");
      return;
    }
    onApplyAction(startYmd, endYmd);
    setPickerOpen(false);
    setCalendarRangeDraft(undefined);
  };

  const triggerLabel = isActive
    ? formatYmdRangeTriggerLabel(value.startYmd, value.endYmd)
    : inactiveTriggerLabel;

  return (
    <Popover open={pickerOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !scopeReady}
          aria-pressed={isActive}
          aria-label={
            isActive
              ? `Tilpasset periode: ${triggerLabel}`
              : "Velg tilpasset periode"
          }
          className={cn(
            triggerClassName,
            "inline-flex h-8 max-h-8 min-h-8 items-center gap-0.5 rounded-md border-border/60 px-1.5 text-[11px] font-normal leading-none shadow-none sm:px-2 sm:text-xs",
            isActive &&
              "border-primary/40 bg-accent font-medium text-foreground",
            "transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.97]",
          )}
        >
          <CalendarIcon className="size-3 shrink-0 text-muted-foreground sm:size-3.5" />
          <span className="hidden min-w-0 truncate sm:inline max-w-48">
            {triggerLabel}
          </span>
          <span className="sm:hidden">{isActive ? "…" : "Per."}</span>
          <ChevronDown className="size-3 shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
        className="z-50 w-[min(calc(100vw-1rem),22rem)] overflow-hidden rounded-lg border border-border/80 bg-popover p-0 shadow-lg"
      >
        <div className="border-b border-border/40 bg-muted/15 px-2.5 py-1.5 dark:bg-muted/10">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-medium text-foreground">
              {popoverTitle}
            </p>
            {rangePickStep === "need-end" ? (
              <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-primary">
                Velg sluttdato
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <div className="rounded-md border border-border/70 bg-background/90 px-1.5 py-1">
              <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                Fra
              </p>
              <p className="truncate text-[11px] font-semibold leading-tight text-foreground">
                {chipFromLabel}
              </p>
            </div>
            <div
              className={cn(
                "rounded-md border px-1.5 py-1",
                rangePickStep === "need-end"
                  ? "border-primary/35 bg-primary/8"
                  : "border-border/70 bg-background/90",
              )}
            >
              <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                Til
              </p>
              <p className="truncate text-[11px] font-semibold leading-tight text-foreground">
                {chipToLabel}
              </p>
            </div>
          </div>
          {helperText ? (
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
              {helperText}
            </p>
          ) : null}
        </div>

        {!scopeReady ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            {scopeNotReadyMessage}
          </p>
        ) : boundsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner variant="ring" size={20} label="Laster kalendergrenser" />
          </div>
        ) : !observationBounds ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            {emptyBoundsMessage}
          </p>
        ) : (
          <>
            <div className="flex max-h-[min(52dvh,340px)] justify-center overflow-y-auto px-2 pb-1 pt-0.5">
              <Calendar
                mode="range"
                timeZone={CUSTOM_DATE_RANGE_OSLO_TZ}
                noonSafe
                month={calendarMonth}
                onMonthChange={(m) => {
                  setCalendarMonthOverride(
                    m instanceof TZDate
                      ? m
                      : tzMonthFromOsloYmd(osloYmdFromDate(m)),
                  );
                }}
                showOutsideDays={false}
                selected={calendarRangeDraft}
                onSelect={handleDateRangeSelect}
                numberOfMonths={1}
                locale={nb}
                startMonth={startMonthNav}
                endMonth={endMonthNav}
                disabled={isCalendarDayDisabled}
                className="w-full min-w-0 px-0.5 py-0"
                classNames={customDateRangeCalendarClassNames}
              />
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/30 bg-muted/10 px-2 py-1.5 dark:bg-muted/5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                disabled={!calendarRangeDraft}
                onClick={() => setCalendarRangeDraft(undefined)}
              >
                Nullstill utkast
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2.5 text-[11px] transition-transform duration-150 ease-out active:scale-[0.97]"
                disabled={!draftComplete}
                onClick={handleApply}
              >
                Bruk periode
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
