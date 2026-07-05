import type { EvalDatasetProvenance } from "@/lib/sd-anlegg/mpc/shared/types";
import { isMpcEvalSampleStale } from "@/services/mpc/eval-coverage-flags";
import { getMpcSdStaleSampleHours } from "@/lib/config/thesis-eval";

function formatOsloShort(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatCount(value: number): string {
  return value.toLocaleString("nb-NO");
}
export function formatMpcDatasetProvenanceLine(input: {
  stepCount: number;
  provenance: EvalDatasetProvenance | null | undefined;
  evalEnd?: string | null;
  now?: Date;
}): string | null {
  const { stepCount, provenance, evalEnd, now } = input;
  if (!provenance) return null;

  const rows = provenance.tables.infraspawnBacnetSample.rowCount;
  const latest = provenance.tables.infraspawnBacnetSample.latestSampleAt;
  const stale =
    evalEnd != null &&
    latest != null &&
    isMpcEvalSampleStale({
      latestSampleAt: latest,
      evalEnd,
      now,
      staleAfterHours: getMpcSdStaleSampleHours(),
    });
  const parts = [
    `${formatCount(stepCount)} intervaller`,
    `${formatCount(rows)} BACnet-rader`,
  ];
  if (latest) {
    parts.push(`siste ${formatOsloShort(latest)}${stale ? " (stale)" : ""}`);
  }
  return parts.join(" · ");
}

export type MpcDatasetProvenanceDetail = {
  label: string;
  value: string;
};
export function buildMpcDatasetProvenanceDetails(
  provenance: EvalDatasetProvenance | null | undefined,
): MpcDatasetProvenanceDetail[] {
  if (!provenance) return [];

  const { tables, gapFillApplied } = provenance;
  const latest = tables.infraspawnBacnetSample.latestSampleAt;

  return [
    {
      label: "Primærkilde",
      value: "Postgres (replay leser aldri Influx direkte)",
    },
    {
      label: "BACnet 15 min",
      value: `${formatCount(tables.infraspawnBacnetSample.rowCount)} rader${
        latest ? ` · siste ${formatOsloShort(latest)}` : ""
      }`,
    },
    {
      label: "Værobservasjoner",
      value: `${formatCount(tables.weatherObservation.rowCount)} timer`,
    },
    {
      label: "Spotpris",
      value: `${formatCount(tables.hourlyEnergyPrices.rowCount)} timer`,
    },
    {
      label: "Bygg energi/kost",
      value: `${formatCount(tables.buildingHourlyCostCache.rowCount)} timer`,
    },
    {
      label: "Alarmer (eval-vindu)",
      value: formatCount(tables.infraspawnAlarmEvent.rowCount),
    },
    {
      label: "Gap-fill",
      value: gapFillApplied
        ? "Aktiv — manglende 15-min kan fylles fremover/bakover"
        : "Av",
    },
  ];
}
