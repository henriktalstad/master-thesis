"use client";

import { useMemo, useState } from "react";
import { useSdAnleggPointSeries } from "@/components/sd-anlegg/use-sd-anlegg-point-series";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

const CHART_HOURS = 24;

function MiniSparkline({
  samples,
}: {
  samples: readonly { t: string; value: number | null }[];
}) {
  const numeric = samples.filter((s) => s.value != null) as {
    t: string;
    value: number;
  }[];
  if (numeric.length < 2) {
    return <span className="text-xs text-muted-foreground">For få datapunkter</span>;
  }

  const values = numeric.map((s) => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 160;
  const h = 40;

  const points = numeric
    .map((s, i) => {
      const x = (i / (numeric.length - 1)) * w;
      const y = h - ((s.value - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="text-primary" aria-hidden>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

export function PointSeriesExplorer({
  points,
  buildingSlug,
}: {
  points: InfraspawnPointListItem[];
  buildingSlug: string;
}) {
  const withValues = useMemo(
    () => points.filter((p) => p.lastValue != null).slice(0, 6),
    [points],
  );

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    () => withValues[0]?.objectId ?? null,
  );

  const selected = withValues.find((p) => p.objectId === selectedObjectId);

  const { chartSeries, isPending, error } = useSdAnleggPointSeries({
    buildingSlug,
    point: selected!,
    chartHours: CHART_HOURS,
    enabled: Boolean(selected),
  });

  const entry = chartSeries[0];

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Tidsserie (24 t)
      </h2>

      {withValues.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Velg punkter med verdier først.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {withValues.map((point) => (
              <button
                key={point.objectId}
                type="button"
                onClick={() => setSelectedObjectId(point.objectId)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  point.objectId === selectedObjectId
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {point.objectName ?? point.objectId}
              </button>
            ))}
          </div>

          {isPending && (
            <p className="text-sm text-muted-foreground">Laster serie…</p>
          )}
          {error && (
            <p className="text-sm text-destructive">{error.message}</p>
          )}
          {entry && (
            <div className="flex items-center gap-4">
              <MiniSparkline samples={entry.samples} />
              <span className="text-xs text-muted-foreground">
                {entry.samples.length} punkter
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
