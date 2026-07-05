import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdAnleggChartRangeHours } from "@/lib/infraspawn/sd-anlegg-chart-policy";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { SdAnleggChartSeries } from "./sd-anlegg-chart-data";
import { SdAnleggPointChart } from "./sd-anlegg-point-chart";
import { SdAnleggSelectedChips } from "./sd-anlegg-selected-chips";
import {
  SD_ANLEGG_BTN_PRESS,
  SD_ANLEGG_CARD,
  SD_ANLEGG_FILTER_ACTIVE,
  SD_ANLEGG_FILTER_BTN,
  SD_ANLEGG_FILTER_IDLE,
} from "@/components/sd-anlegg/sd-anlegg-ui";

type Props = {
  chartTitle: string;
  selectedPoints: InfraspawnPointListItem[];
  chartSeries: SdAnleggChartSeries[];
  dataCoverage: string | null;
  chartHours: number;
  chartRangeOptions: ReadonlyArray<{ hours: SdAnleggChartRangeHours; label: string }>;
  onChartHoursChange: (hours: SdAnleggChartRangeHours) => void;
  seriesLoading: boolean;
  seriesError: Error | null;
  seriesFetching: boolean;
  onTogglePoint: (point: InfraspawnPointListItem) => void;
  onClearSelected: () => void;
};

export function SdAnleggChartCard({
  chartTitle,
  selectedPoints,
  chartSeries,
  dataCoverage,
  chartHours,
  chartRangeOptions,
  onChartHoursChange,
  seriesLoading,
  seriesError,
  seriesFetching,
  onTogglePoint,
  onClearSelected,
}: Props) {
  return (
    <Card className={SD_ANLEGG_CARD}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">{chartTitle}</CardTitle>
            <CardDescription className="text-foreground/70">
              {selectedPoints.length === 0
                ? "Kryss av signaler i tabellen over"
                : "Historikk for valgt tidsrom"}
              {dataCoverage ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {dataCoverage}
                </span>
              ) : null}
            </CardDescription>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {chartRangeOptions.map((option) => (
              <button
                key={option.hours}
                type="button"
                onClick={() => onChartHoursChange(option.hours)}
                className={cn(
                  SD_ANLEGG_FILTER_BTN,
                  SD_ANLEGG_BTN_PRESS,
                  "shrink-0 snap-start",
                  chartHours === option.hours
                    ? SD_ANLEGG_FILTER_ACTIVE
                    : SD_ANLEGG_FILTER_IDLE,
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <SdAnleggSelectedChips
          selectedPoints={selectedPoints}
          chartSeries={chartSeries}
          onToggle={onTogglePoint}
          onClearAll={onClearSelected}
        />

        {seriesLoading ? (
          <div className="flex min-h-[16rem] items-center justify-center">
            <Spinner variant="dots" label="Laster graf …" />
          </div>
        ) : seriesError ? (
          <p className="text-sm text-destructive">{seriesError.message}</p>
        ) : (
          <div
            className={cn(
              "transition-opacity duration-150 ease-out",
              seriesFetching && "opacity-60",
            )}
          >
            <SdAnleggPointChart series={chartSeries} hours={chartHours} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
