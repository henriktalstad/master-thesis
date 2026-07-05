"use client";

import { buildInfraspawnPointStub } from "@/lib/infraspawn/build-infraspawn-point-stub";
import { formatSdAnleggPointDisplayValue } from "@/lib/sd-anlegg/format-process-slot-display";
import type { SdAnleggChartSeries } from "./sd-anlegg-chart-data";
import { formatSdAnleggChartAxisTime } from "./sd-anlegg-chart-data";
import type { SdAnleggPointChartTooltipPayload } from "./sd-anlegg-point-chart-formatting";

export function SdAnleggPointChartTooltipContent({
  active,
  payload,
  label,
  seriesMap,
  spanMs,
}: {
  active?: boolean;
  payload?: SdAnleggPointChartTooltipPayload;
  label?: string | number;
  seriesMap: Map<string, SdAnleggChartSeries>;
  spanMs: number;
}) {
  if (!active || !payload?.length) return null;
  const ts = Number(label ?? payload[0]?.payload?.timestamp);
  return (
    <div className="max-w-xs rounded-lg border border-border/60 bg-background px-3 py-2 text-xs shadow-sm">
      <p className="mb-1.5 text-muted-foreground">
        {formatSdAnleggChartAxisTime(ts, spanMs)}
      </p>
      <ul className="space-y-1">
        {payload.map((entry) => {
          const key = String(entry.dataKey ?? "");
          const meta = seriesMap.get(key);
          if (!meta) return null;
          return (
            <li key={key} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                <span className="truncate">{meta.label}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {formatSdAnleggPointDisplayValue(
                  buildInfraspawnPointStub({
                    sourceId: meta.objectId ?? meta.key,
                    objectId: meta.objectId ?? meta.key,
                    objectName: meta.objectName ?? null,
                    description: meta.description ?? null,
                    unit: meta.unit,
                    lastValue:
                      typeof entry.value === "number" ? entry.value : null,
                    quality: "ok",
                  }),
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
