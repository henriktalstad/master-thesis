import type { SdAnleggMpcPipelineChartPoint, SdAnleggSupervisoryCommand } from "@/generated/client";

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildSupervisoryCommandsCsv(
  rows: readonly Pick<
    SdAnleggSupervisoryCommand,
    | "stepAt"
    | "policyId"
    | "kind"
    | "status"
    | "uProposed"
    | "uReference"
    | "signals"
  >[],
): string {
  const header = [
    "step_at",
    "policy_id",
    "kind",
    "status",
    "u_proposed_json",
    "u_reference_json",
    "signals_json",
  ].join(",");

  const body = rows.map((row) =>
    [
      row.stepAt.toISOString(),
      row.policyId,
      row.kind,
      row.status,
      JSON.stringify(row.uProposed),
      row.uReference != null ? JSON.stringify(row.uReference) : "",
      row.signals != null ? JSON.stringify(row.signals) : "",
    ]
      .map(csvEscape)
      .join(","),
  );

  return `${header}\n${body.join("\n")}\n`;
}

export function buildChartPointsJson(
  rows: readonly Pick<
    SdAnleggMpcPipelineChartPoint,
    | "series"
    | "bucketAt"
    | "baselineKr"
    | "mpcKr"
    | "deltaKr"
    | "extractMeasC"
    | "extractPredC"
    | "bandMinC"
    | "bandMaxC"
    | "baselineKw"
    | "mpcKw"
    | "emulatedKw"
  >[],
): string {
  return `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      pointCount: rows.length,
      points: rows.map((row) => ({
        series: row.series,
        bucketAt: row.bucketAt.toISOString(),
        baselineKr: row.baselineKr,
        mpcKr: row.mpcKr,
        deltaKr: row.deltaKr,
        extractMeasC: row.extractMeasC,
        extractPredC: row.extractPredC,
        bandMinC: row.bandMinC,
        bandMaxC: row.bandMaxC,
        baselineKw: row.baselineKw,
        mpcKw: row.mpcKw,
        emulatedKw: row.emulatedKw,
      })),
    },
    null,
    2,
  )}\n`;
}
