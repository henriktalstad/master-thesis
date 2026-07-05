"use client";

import { useMemo, useState } from "react";
import { formatInfraspawnAlarmTimestamp } from "@/lib/infraspawn/display-format";
import { isFreshInfluxLiveSample } from "@/lib/infraspawn/live-display-policy";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { useSdAnleggPoints } from "@/queries/infraspawn";

function formatValue(point: InfraspawnPointListItem) {
  if (point.lastValue == null) return "—";
  const n = point.lastValue;
  if (Math.abs(n) >= 100) return n.toFixed(1);
  if (Math.abs(n) >= 10) return n.toFixed(2);
  return n.toFixed(3);
}

function formatSampledAt(iso: string | null) {
  if (!iso) return "—";
  return formatInfraspawnAlarmTimestamp(iso);
}

export function LivePointsPanel({
  buildingSlug,
}: {
  buildingSlug: string;
}) {
  const [search, setSearch] = useState("");

  const { data, error, isLoading, isFetching, dataUpdatedAt } =
    useSdAnleggPoints(buildingSlug);

  const points = useMemo(() => {
    const all = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (p) =>
        p.objectName?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.objectId.toLowerCase().includes(q),
    );
  }, [data, search]);

  const freshCount = points.filter(
    (p) => p.lastSampledAt && isFreshInfluxLiveSample(p.lastSampledAt),
  ).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Live punkter (Postgres sync)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Oppdateres hvert 2 s (Influx-tail hvert 15 s) · {points.length} punkter
            {freshCount > 0 ? ` · ${freshCount} ferske (<20 min)` : ""}
            {isFetching ? " · henter…" : ""}
          </p>
        </div>
        <input
          type="search"
          placeholder="Søk objectName, beskrivelse…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-lg border bg-background px-3 py-2 text-sm"
        />
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Laster punkter…</p>
      )}
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error.message}
        </p>
      )}

      {!isLoading && !error && points.length === 0 && (
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Ingen punkter — sjekk DATABASE_URL og BUILDING_SLUG.
        </p>
      )}

      {points.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Signal</th>
                <th className="px-3 py-2 font-medium">Verdi</th>
                <th className="px-3 py-2 font-medium">Enhet</th>
                <th className="px-3 py-2 font-medium">Sist samplet</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {points.map((point) => (
                <tr key={`${point.sourceId}:${point.objectId}`}>
                  <td className="px-3 py-2">
                    <div className="font-mono">
                      {point.objectName ?? point.objectId}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {point.description ?? point.objectId}
                    </div>
                  </td>
                  <td className="px-3 py-2 tabular-nums font-medium">
                    {formatValue(point)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {point.unit ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatSampledAt(point.lastSampledAt)}
                  </td>
                  <td className="px-3 py-2">
                    {point.lastSampledAt &&
                    isFreshInfluxLiveSample(point.lastSampledAt) ? (
                      <span className="text-emerald-700">OK</span>
                    ) : (
                      <span className="text-amber-700">Stale</span>
                    )}
                    {point.statusInAlarm && (
                      <span className="ml-2 text-red-600">Alarm</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dataUpdatedAt > 0 && (
        <p className="text-xs text-muted-foreground">
          Sist oppdatert {new Date(dataUpdatedAt).toLocaleTimeString("nb-NO")}
        </p>
      )}
    </section>
  );
}
