"use client";

import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DatePickerProps = {
  id?: string;
  value?: string;
  onChangeAction: (value: string) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  align?: "start" | "center" | "end";
  className?: string;
  yearRange?: { from: number; to: number };
};

function parseDate(value?: string) {
  return value ? new Date(value) : undefined;
}

function toLocalYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(value?: string) {
  try {
    return value ? new Date(value).toLocaleDateString("no-NO") : "";
  } catch {
    return "";
  }
}

export function DatePicker({
  id,
  value,
  onChangeAction,
  placeholder = "Velg dato",
  disabled,
  align = "start",
  className,
  yearRange,
}: DatePickerProps) {
  const months = [
    "Januar",
    "Februar",
    "Mars",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const initial = parseDate(value) ?? new Date();
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(
    new Date(initial.getFullYear(), initial.getMonth(), 1),
  );
  const currentYear = new Date().getFullYear();
  const rangeFrom = yearRange?.from ?? currentYear - 10;
  const rangeTo = yearRange?.to ?? currentYear + 10;
  const years = React.useMemo(() => {
    const out: number[] = [];
    for (let y = rangeFrom; y <= rangeTo; y++) out.push(y);
    return out;
  }, [rangeFrom, rangeTo]);
  const monthSelectId = React.useId();
  const yearSelectId = React.useId();

  const handleChange = (next?: Date) => {
    const str = next ? toLocalYmd(next) : "";
    onChangeAction(str);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4 opacity-60" />
          {value ? formatDisplay(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        <div className="border-b border-border p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Label
                htmlFor={monthSelectId}
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Måned
              </Label>
              <Select
                value={String(visibleMonth.getMonth())}
                onValueChange={(m) => {
                  const month = Number(m);
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), month, 1),
                  );
                }}
              >
                <SelectTrigger id={monthSelectId} size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((label, idx) => (
                    <SelectItem key={label} value={String(idx)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-28">
              <Label
                htmlFor={yearSelectId}
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                År
              </Label>
              <Select
                value={String(visibleMonth.getFullYear())}
                onValueChange={(y) => {
                  const year = Number(y);
                  setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1));
                }}
              >
                <SelectTrigger id={yearSelectId} size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Calendar
          mode="single"
          month={visibleMonth}
          onMonthChange={setVisibleMonth}
          selected={parseDate(value)}
          onSelect={(date) => handleChange(date)}
          disabled={disabled}
          classNames={{
            caption_label: "sr-only",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export default DatePicker;
