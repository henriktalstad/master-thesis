import { TZDate } from "react-day-picker";

export const CUSTOM_DATE_RANGE_OSLO_TZ = "Europe/Oslo" as const;

export function tzMonthFromOsloYmd(ymd: string): TZDate {
  const [y, m] = ymd.split("-").map(Number);
  return new TZDate(y, m - 1, 1, CUSTOM_DATE_RANGE_OSLO_TZ);
}

export function tzDateFromOsloYmd(ymd: string): TZDate {
  const [y, m, d] = ymd.split("-").map(Number);
  return new TZDate(y, m - 1, d, CUSTOM_DATE_RANGE_OSLO_TZ);
}

export function formatShortDateOslo(d: Date): string {
  return d.toLocaleDateString("nb-NO", {
    timeZone: CUSTOM_DATE_RANGE_OSLO_TZ,
    day: "numeric",
    month: "short",
  });
}

export function formatChipDateOslo(d: Date): string {
  return d.toLocaleDateString("nb-NO", {
    timeZone: CUSTOM_DATE_RANGE_OSLO_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatYmdRangeTriggerLabel(
  startYmd: string,
  endYmd: string,
): string {
  const from = tzDateFromOsloYmd(startYmd);
  const to = tzDateFromOsloYmd(endYmd);
  return `${formatShortDateOslo(from)} – ${formatShortDateOslo(to)}`;
}

export const customDateRangeCalendarClassNames = {
  months: "relative flex flex-col gap-0.5",
  month: "flex w-full flex-col gap-0.5",
  month_caption:
    "relative z-0 mb-0 flex h-7 w-full items-center justify-center px-7 pt-0",
  caption_label: "text-[11px] font-semibold",
  nav: "absolute inset-x-0 top-0 z-10 flex w-full items-center justify-between gap-0.5 px-0",
  button_previous:
    "size-6 shrink-0 border border-border/60 bg-background p-0 opacity-80 hover:opacity-100 shadow-sm",
  button_next:
    "size-6 shrink-0 border border-border/60 bg-background p-0 opacity-80 hover:opacity-100 shadow-sm",
  weekdays: "flex w-full",
  weekday:
    "w-8 text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground",
  week: "mt-px flex w-full",
  day_button:
    "size-8 min-h-8 min-w-8 max-h-8 max-w-8 p-0 text-[11px] leading-none",
};

export type CustomDateRangePeriodValue = {
  startYmd: string;
  endYmd: string;
} | null;
