"use client";

import { useMemo } from "react";
import type {
  ControlPlantModel,
  MpcEvalCoverageSummary,
} from "@/lib/sd-anlegg/control/control-types";
import {
  buildSignalCatalogRows,
  CONTROL_ROLE_LABELS,
  CONTROL_SUBSYSTEM_LABELS,
  summarizeSignalCatalog,
} from "@/lib/sd-anlegg/control/signal-catalog-rows";
import { CONTROL_SETUP_UI } from "@/lib/sd-anlegg/control/control-display-labels";
import { formatInfraspawnPointValue } from "@/lib/infraspawn/display-format";
import { Badge } from "@/components/ui/badge";
import { SdAnleggControlCollapsibleSection } from "@/components/sd-anlegg/control/shared/section";
import { cn } from "@/lib/utils";

type Props = {
  plantModel: ControlPlantModel;
  evalCoverage?: MpcEvalCoverageSummary | null;
  defaultOpen?: boolean;
};

function availabilityLabel(
  availability: "available" | "missing" | "expected_missing",
): { label: string; className: string } {
  switch (availability) {
    case "available":
      return {
        label: "Live OK",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
      };
    case "expected_missing":
      return {
        label: "Forventet hull",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
      };
    default:
      return {
        label: "Mangler",
        className: "text-muted-foreground",
      };
  }
}

export function SdAnleggControlSignalCatalogPanel({
  plantModel,
  evalCoverage = null,
  defaultOpen = false,
}: Props) {
  const rows = useMemo(
    () => buildSignalCatalogRows({ plantModel, evalCoverage }),
    [plantModel, evalCoverage],
  );
  const summary = useMemo(() => summarizeSignalCatalog(rows), [rows]);

  return (
    <SdAnleggControlCollapsibleSection
      title={CONTROL_SETUP_UI.signalCatalogTitle}
      description={CONTROL_SETUP_UI.signalCatalogDescription(
        summary.total,
        summary.available,
        summary.inEval,
      )}
      badge={summary.criticalMissing.length > 0 ? "Mangler data" : undefined}
      defaultOpen={defaultOpen}
    >
      <div className="space-y-3 px-4 pb-4">
        {summary.criticalMissing.length > 0 ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            Kritiske signaler uten live mapping: {summary.criticalMissing.join(", ")}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full min-w-[880px] text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Signal</th>
                <th className="px-3 py-2 text-left font-medium">Subsystem</th>
                <th className="px-3 py-2 text-left font-medium">Rolle</th>
                <th className="px-3 py-2 text-left font-medium">Simulert</th>
                <th className="px-3 py-2 text-right font-medium">
                  {CONTROL_SETUP_UI.signalCatalogCoverageCol}
                </th>
                <th className="px-3 py-2 text-right font-medium">Siste verdi</th>
                <th className="px-3 py-2 text-left font-medium">Datakilde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row) => {
                const avail = availabilityLabel(row.availability);
                return (
                  <tr key={row.spec.canonicalId}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{row.spec.label}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {row.spec.canonicalId}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {CONTROL_SUBSYSTEM_LABELS[row.spec.subsystem]}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {CONTROL_ROLE_LABELS[row.spec.controlRole]}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.spec.controlRole === "mpc_actuator" ? (
                          <RoleBadge label={CONTROL_SETUP_UI.signalCatalogBadgeControl} />
                        ) : null}
                        {row.spec.inUMeasRequired ? (
                          <RoleBadge label={CONTROL_SETUP_UI.signalCatalogBadgeMeasure} />
                        ) : null}
                        {row.spec.inEvalDataset ? (
                          <RoleBadge label={CONTROL_SETUP_UI.signalCatalogBadgeSim} variant="outline" />
                        ) : null}
                        {row.spec.critical ? <RoleBadge label="kritisk" variant="destructive" /> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {!row.spec.inEvalDataset
                        ? "—"
                        : row.evalSamplePct != null
                          ? `${row.evalSamplePct} %`
                          : "Ikke mappet"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col items-end gap-1">
                        {row.lastValue != null ? (
                          <span className="font-medium tabular-nums text-foreground">
                            {formatInfraspawnPointValue(row.lastValue, row.spec.unit)}
                          </span>
                        ) : null}
                        <Badge variant="outline" className={cn("h-5 text-[10px]", avail.className)}>
                          {avail.label}
                        </Badge>
                      </div>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-muted-foreground">
                      {row.objectName ?? row.spec.influxPatterns[0] ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <SdAnleggControlCollapsibleSection
          title={CONTROL_SETUP_UI.signalCatalogFagfolkTitle}
          description={CONTROL_SETUP_UI.signalCatalogFagfolkDescription}
        >
          <p className="px-4 pb-4 text-[11px] text-muted-foreground">
            Dekning i simulering = andel 15-min intervaller med måling i
            evalueringsvinduet. Siste verdi = nyeste Influx-sample (
            {plantModel.dataQuality.catalogCoveragePct} % katalogdekning). «Forventet hull»
            finnes i anlegget men eksporteres sjelden til SD. «Ikke mappet» = signal uten
            funnet BACnet-punkt i kilden.
          </p>
        </SdAnleggControlCollapsibleSection>
      </div>
    </SdAnleggControlCollapsibleSection>
  );
}

function RoleBadge({
  label,
  variant = "secondary",
}: {
  label: string;
  variant?: "secondary" | "outline" | "destructive";
}) {
  return (
    <Badge variant={variant} className="h-5 px-1.5 text-[10px] font-normal">
      {label}
    </Badge>
  );
}
