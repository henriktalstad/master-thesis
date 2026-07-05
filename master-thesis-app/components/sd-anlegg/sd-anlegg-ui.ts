export const SD_ANLEGG_BTN_PRESS =
  "motion-safe:active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-100 motion-safe:ease-out";

export const SD_ANLEGG_FILTER_BTN =
  "rounded-full border px-3 py-1.5 text-xs font-medium transition-[background-color,border-color,color] duration-150 ease-out";

export const SD_ANLEGG_NAV_TAB =
  "inline-flex min-h-10 shrink-0 snap-start items-center gap-1.5 rounded-lg border-b-2 px-3 py-2 text-sm font-medium transition-[border-color,color,background-color,box-shadow] duration-150 ease-out sm:px-3.5";

export const SD_ANLEGG_NAV_TAB_ACTIVE =
  "border-primary bg-background text-foreground shadow-sm";

export const SD_ANLEGG_NAV_TAB_IDLE =
  "border-transparent text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:border-border/80 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-background/60 [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground";

export const SD_ANLEGG_NAV_SHELL =
  "rounded-xl border border-border/80 bg-muted/20 p-1";

export const SD_ANLEGG_UNIT_PILL =
  "inline-flex w-fit max-w-full min-h-9 shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium whitespace-nowrap transition-[border-color,background-color,color,box-shadow] duration-150 ease-out";

export const SD_ANLEGG_CARD =
  "border border-border bg-card shadow-sm";

export const SD_ANLEGG_STAT_TILE =
  "rounded-lg border border-border bg-muted/50 px-4 py-3";

export const SD_ANLEGG_KEY_POINT_TILE =
  "rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5 transition-[border-color,background-color,opacity] duration-150 ease-out";

export const SD_ANLEGG_KEY_POINT_VALUE =
  "text-xl font-semibold leading-none tabular-nums tracking-tight text-foreground transition-opacity duration-150 ease-out sm:text-[1.35rem]";

export const SD_ANLEGG_KEY_POINT_UNIT =
  "text-sm font-normal leading-none text-muted-foreground/80";

export const SD_ANLEGG_INFO_BANNER =
  "rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-foreground";

export const SD_ANLEGG_FILTER_ACTIVE =
  "border-primary bg-primary text-primary-foreground shadow-sm";

export const SD_ANLEGG_FILTER_IDLE =
  "border-border bg-background text-foreground/90 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/70";

export const SD_ANLEGG_SUB_NAV_BTN =
  "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-[background-color,border-color,color] duration-150 ease-out";

export const SD_ANLEGG_SUB_NAV_ACTIVE =
  "border-primary/50 bg-primary/10 text-foreground";

export const SD_ANLEGG_SUB_NAV_IDLE =
  "border-border/70 bg-background/80 text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:border-border [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/50 [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground";

export const SD_ANLEGG_ANALYSIS_NAV_SHELL =
  "border-b border-border/80 bg-transparent";

export const SD_ANLEGG_ANALYSIS_NAV_BTN =
  "inline-flex min-h-9 shrink-0 snap-start items-center rounded-none border-0 border-b-2 px-3 py-2 text-xs font-medium transition-[border-color,color] duration-150 ease-out";

export const SD_ANLEGG_ANALYSIS_NAV_ACTIVE =
  "border-primary text-foreground";

export const SD_ANLEGG_ANALYSIS_NAV_IDLE =
  "border-transparent text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:border-border/80 [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground";

export const SD_ANLEGG_ROW_INTERACTIVE =
  "cursor-pointer transition-[background-color,border-color] duration-150 ease-out hover:bg-transparent motion-safe:active:bg-muted/70 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/50";

export const SD_ANLEGG_ROW_SELECTED =
  "border-l-[3px] border-l-primary bg-primary/5 shadow-[inset_0_0_0_1px_hsl(var(--border))]";

export const SD_ANLEGG_OVERVIEW_WIDGET =
  "flex h-full flex-col rounded-xl border border-border bg-card shadow-sm";

export const SD_ANLEGG_OVERVIEW_WIDGET_BODY = "flex flex-1 flex-col p-3.5 sm:p-4";

export const SD_ANLEGG_OVERVIEW_WIDGET_FOOTER =
  "mt-auto flex justify-end border-t border-border/60 pt-3";

export const SD_ANLEGG_CONTACT_ICON_BTN =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[color,background-color] duration-150 ease-out motion-safe:active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/70 [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground";

export const SD_ANLEGG_CONTACT_PHONE =
  "text-sm font-semibold tabular-nums tracking-tight text-foreground";

export const SD_ANLEGG_ALARM_GROUP_CARD =
  "rounded-xl border border-border/80 bg-card transition-[border-color,box-shadow] duration-150 ease-out";

export const SD_ANLEGG_ALARM_SEVERITY_ACCENT: Record<
  "A" | "B" | "C" | "FAULT",
  string
> = {
  A: "border-l-destructive",
  B: "border-l-warning",
  C: "border-l-[hsl(var(--chart-production))]",
  FAULT: "border-l-muted-foreground/50",
};

export const SD_ANLEGG_ALARM_SEVERITY_BADGE: Record<
  "A" | "B" | "C" | "FAULT",
  string
> = {
  A: "border-destructive/35 bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground",
  B: "border-warning/40 bg-warning/15 text-warning-foreground dark:bg-warning/20",
  C: "border-[hsl(var(--chart-production)/0.45)] bg-[hsl(var(--chart-production)/0.12)] text-foreground dark:bg-[hsl(var(--chart-production)/0.18)]",
  FAULT:
    "border-border bg-muted/60 text-muted-foreground dark:bg-muted/40 dark:text-muted-foreground",
};

export const SD_ANLEGG_STATUS_FAULT_BADGE =
  "border-warning/45 bg-warning/12 font-normal text-warning-foreground dark:border-warning/50 dark:bg-warning/18";

export const SD_ANLEGG_STATUS_ATTENTION_BADGE =
  "border-warning/40 bg-warning/15 text-warning-foreground hover:bg-warning/15 dark:bg-warning/20";

export const SD_ANLEGG_STATUS_OK_BADGE =
  "border-success/35 bg-success/12 text-success hover:bg-success/12 dark:bg-success/18 dark:text-success-foreground";

export const SD_ANLEGG_STATUS_OK_DOT = "inline-block size-3 rounded-full bg-success";

export const SD_ANLEGG_KPI_CARD =
  "overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm ring-1 ring-border/30 dark:ring-border/50";

export const SD_ANLEGG_KPI_VALUE =
  "text-xl font-bold tabular-nums tracking-tight text-primary";

export const SD_ANLEGG_WORKSPACE_TABS_LIST =
  "grid h-10 w-full grid-cols-2 gap-1 rounded-xl border border-border/80 bg-muted/40 p-1 shadow-sm dark:bg-muted/25 sm:inline-flex sm:w-auto";

export const SD_ANLEGG_WORKSPACE_TABS_TRIGGER =
  "rounded-lg px-4 py-1.5 text-sm font-medium text-muted-foreground transition-[background-color,color,box-shadow] duration-150 ease-out data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm dark:data-[state=active]:shadow-primary/20";

export const SD_ANLEGG_CHART_SHELL =
  "rounded-lg border border-border/80 bg-background p-2 transition-opacity duration-150 ease-out dark:bg-card/60";

export const SD_ANLEGG_SCHEMATIC_SHELL =
  "overflow-hidden rounded-xl bg-card";

export const SD_ANLEGG_SCHEMATIC_HEADER =
  "border-b border-border/20 px-4 py-1.5 text-center text-xs font-medium tracking-wide text-muted-foreground";

export const SD_ANLEGG_SCHEMATIC_CANVAS =
  "bg-gradient-to-b from-muted/35 to-background px-3 py-4 dark:from-muted/20 dark:to-card md:px-4 md:py-5";

export const SD_ANLEGG_SCHEMATIC_LANE_LABEL =
  "text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55 dark:text-foreground/60";

export const SD_ANLEGG_SCHEMATIC_LANE =
  "relative min-h-[6.5rem] overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm dark:border-border/90 dark:bg-card/95";

export type SdAnleggSchematicLaneVariant = "duct" | "pipe" | "sensor";

export const SD_ANLEGG_SCHEMATIC_LANE_BAND: Record<
  SdAnleggSchematicLaneVariant,
  string
> = {
  duct: "bg-primary/20 dark:bg-primary/32",
  pipe: "bg-[hsl(var(--chart-4)/0.22)] dark:bg-[hsl(var(--chart-4)/0.34)]",
  sensor: "bg-[hsl(var(--chart-3)/0.18)] dark:bg-[hsl(var(--chart-3)/0.28)]",
};

export const SD_ANLEGG_SCHEMATIC_CONNECTOR_STROKE: Record<
  SdAnleggSchematicLaneVariant,
  string
> = {
  duct: "stroke-primary/50 dark:stroke-primary/68",
  pipe: "stroke-[hsl(var(--chart-4)/0.7)] dark:stroke-[hsl(var(--chart-4)/0.82)]",
  sensor: "stroke-[hsl(var(--chart-3)/0.68)] dark:stroke-[hsl(var(--chart-3)/0.8)]",
};

export const SD_ANLEGG_SCHEMATIC_CONNECTOR_FILL: Record<
  SdAnleggSchematicLaneVariant,
  string
> = {
  duct: "fill-primary/50 dark:fill-primary/68",
  pipe: "fill-[hsl(var(--chart-4)/0.7)] dark:fill-[hsl(var(--chart-4)/0.82)]",
  sensor: "fill-[hsl(var(--chart-3)/0.68)] dark:fill-[hsl(var(--chart-3)/0.8)]",
};

export const SD_ANLEGG_SCHEMATIC_SYMBOL_BOX =
  "flex size-11 items-center justify-center rounded-md border border-border/70 bg-muted/45 dark:border-border/80 dark:bg-muted/55";

export const SD_ANLEGG_SCHEMATIC_SYMBOL_BOX_SELECTED =
  "border-primary/45 bg-primary/12 dark:border-primary/55 dark:bg-primary/18";

export const SD_ANLEGG_SCHEMATIC_SYMBOL_BOX_ALARM =
  "border-destructive/45 bg-destructive/8 dark:bg-destructive/15";

export const SD_ANLEGG_SCHEMATIC_DUCT =
  "relative min-h-[5.5rem] overflow-hidden rounded-lg border border-border/70 bg-background/60";

export const SD_ANLEGG_SCHEMATIC_DUCT_BAND =
  "pointer-events-none absolute inset-x-8 top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary/15 dark:bg-primary/25";

export const SD_ANLEGG_SCHEMATIC_TILE =
  "relative z-[1] flex shrink-0 flex-col items-center rounded-lg border border-border/80 bg-card text-center shadow-sm transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out motion-safe:active:scale-[0.98] [@media(hover:hover)_and_(pointer:fine)]:hover:border-primary/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary/[0.04] dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary/10 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-md";

export const SD_ANLEGG_SCHEMATIC_TILE_DUCT =
  "min-w-[92px] max-w-[104px]";

export const SD_ANLEGG_SCHEMATIC_TILE_SELECTED =
  "border-primary/55 bg-primary/8 ring-2 ring-primary/30 ring-offset-2 ring-offset-background shadow-md dark:border-primary/65 dark:bg-primary/14 dark:ring-primary/35";

export const SD_ANLEGG_SCHEMATIC_VALUE =
  "font-semibold tabular-nums text-primary";

export const SD_ANLEGG_SCHEMATIC_TAG =
  "truncate text-[9px] font-medium uppercase tracking-wide text-muted-foreground dark:text-muted-foreground/90";

export const SD_ANLEGG_SCHEMATIC_STATUS_STRIP =
  "grid gap-2 rounded-lg border border-border/80 bg-card/90 p-3 dark:bg-card/70 sm:grid-cols-2 lg:grid-cols-4";

export const SD_ANLEGG_SCHEMATIC_STATUS_TILE =
  "flex items-center justify-between gap-2 rounded-md border border-border/80 bg-background px-3 py-2.5 text-left text-sm transition-[border-color,background-color,box-shadow] duration-150 ease-out motion-safe:active:scale-[0.99] dark:bg-card/80 [@media(hover:hover)_and_(pointer:fine)]:hover:border-primary/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary/[0.03] dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary/10";

export const SD_ANLEGG_SCHEMATIC_DETAIL =
  "space-y-3 rounded-lg border border-border/80 bg-card p-4 shadow-sm dark:bg-card/95";

export const SD_ANLEGG_SCHEMATIC_DETAIL_EMPTY =
  "rounded-lg border border-dashed border-border/80 bg-muted/25 px-4 py-8 text-center dark:bg-muted/15";

export const SD_ANLEGG_SCHEMATIC_CANVAS_INNER =
  "relative h-[min(440px,54vh)] w-full overflow-hidden rounded-lg border border-border bg-background";

export const SD_ANLEGG_CANVAS_LANE_ROW =
  "pointer-events-none absolute inset-x-0 border-y border-border/40 bg-muted/30";

export const SD_ANLEGG_VIRTUALIZE_THRESHOLD = 60;

export const SD_ANLEGG_ROW_ESTIMATE_PX = 56;

export function sdAnleggChartPeriodLabel(hours: number): string {
  if (hours >= 168) return `${Math.round(hours / 24)} dager`;
  if (hours === 1) return "1 time";
  return `${hours} timer`;
}
