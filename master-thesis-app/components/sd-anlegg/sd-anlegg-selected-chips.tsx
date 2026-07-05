import { X } from "lucide-react";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { Button } from "@/components/ui/button";
import { formatInfraspawnPointValue, formatInfraspawnPointLabel } from "@/lib/infraspawn/display-format";
import { cn } from "@/lib/utils";
import type { SdAnleggChartSeries } from "./sd-anlegg-chart-data";
import { SD_ANLEGG_CHART_COLORS } from "./sd-anlegg-chart-data";
import { sdAnleggPointKey } from "./sd-anlegg-point-key";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";

type Props = {
  selectedPoints: InfraspawnPointListItem[];
  chartSeries?: SdAnleggChartSeries[];
  onToggle: (point: InfraspawnPointListItem) => void;
  onClearAll: () => void;
};

function resolveChipMeta(
  point: InfraspawnPointListItem,
  index: number,
  chartSeries?: SdAnleggChartSeries[],
) {
  const key = sdAnleggPointKey(point);
  const seriesEntry = chartSeries?.find((entry) => entry.key === key);
  return {
    label: seriesEntry?.label ?? formatInfraspawnPointLabel(point),
    color:
      seriesEntry?.color ??
      SD_ANLEGG_CHART_COLORS[index % SD_ANLEGG_CHART_COLORS.length],
  };
}

export function SdAnleggSelectedChips({
  selectedPoints,
  chartSeries,
  onToggle,
  onClearAll,
}: Props) {
  if (selectedPoints.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {selectedPoints.length === 1
            ? "1 signal i graf"
            : `${selectedPoints.length} signaler i graf`}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 shrink-0 sm:ml-auto", SD_ANLEGG_BTN_PRESS)}
          aria-label="Tøm alle signaler fra graf"
          onClick={onClearAll}
        >
          <X className="size-3.5" aria-hidden />
          Tøm alle
        </Button>
      </div>
      <ul
        className="m-0 flex list-none flex-wrap gap-1.5 p-0"
        aria-label="Valgte signaler i graf"
      >
        {selectedPoints.map((point, index) => {
          const key = sdAnleggPointKey(point);
          const { label, color } = resolveChipMeta(point, index, chartSeries);
          return (
            <li key={key} className="min-w-0">
              <button
                type="button"
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground transition-colors duration-150 ease-out",
                  "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  SD_ANLEGG_BTN_PRESS,
                )}
                aria-label={`Fjern ${label} fra graf`}
                onClick={() => onToggle(point)}
              >
                <span
                  className="size-2 shrink-0 rounded-full ring-1 ring-border/60"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="min-w-0 truncate">{label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatInfraspawnPointValue(point.lastValue, point.unit, point)}
                </span>
                <X className="size-3 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
