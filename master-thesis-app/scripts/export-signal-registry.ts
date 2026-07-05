#!/usr/bin/env bun
/**
 * Eksporter signal_registry.csv — én rad per fysisk punkt (123) + appendix for
 * canonicals uten SD-punkt (utstyrstag). Ingen dobbelttelling.
 *
 * Usage:
 *   bun run export-signal-registry
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildSignalRegistryRows } from "@/lib/sd-anlegg/control/build-signal-registry-rows";
import {
  materializeSorgenfriControlBindings,
  SORGENFRI_VENTILATION_UNIT_KEY,
} from "@/lib/sd-anlegg/control/sorgenfri-control-bindings";
import { mergeControlSignalBindings } from "@/lib/sd-anlegg/control/control-signal-bindings";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

type PointRow = {
  objectId?: string;
  objectName?: string;
  description?: string;
  unit?: string | null;
};

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toListItem(point: PointRow, sourceId: string): InfraspawnPointListItem {
  return {
    sourceId,
    sourceLabel: "Nærbyen",
    objectId: point.objectId ?? point.objectName ?? "",
    objectName: point.objectName ?? null,
    description: point.description ?? null,
    unit: point.unit ?? null,
    lastValue: null,
    lastSampledAt: null,
    valueSource: "postgres-sync",
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
  };
}

async function main() {
  const root = resolve(process.cwd(), "..");
  const pointsPath = resolve(root, "naerbyen-infraspawn-123-points.json");
  const outDir = resolve(root, "data/processed");
  await mkdir(outDir, { recursive: true });

  const payload = JSON.parse(await Bun.file(pointsPath).text()) as {
    source?: { id?: string };
    points?: PointRow[];
  };
  const sourceId = payload.source?.id ?? "export";
  const points = (payload.points ?? []).map((point) => toListItem(point, sourceId));

  const bindings = mergeControlSignalBindings(
    [],
    materializeSorgenfriControlBindings({ sourceId, points }),
    [],
  );

  const rows = buildSignalRegistryRows({
    points,
    context: {
      sourceId,
      bindings,
      unitKey: SORGENFRI_VENTILATION_UNIT_KEY,
    },
  });

  const header = [
    "object_id",
    "object_name",
    "description",
    "unit",
    "canonical_id",
    "canonical_label",
    "kind",
    "subsystem",
    "control_role",
    "application",
    "schema_slot_id",
    "fdv_role",
    "in_mpc_control",
    "in_u_meas",
    "in_eval",
    "catalog_only",
  ].join(",");

  const body = rows.map((row) =>
    [
      row.objectId,
      row.objectName,
      row.description,
      row.unit,
      row.canonicalId,
      row.canonicalLabel,
      row.kind,
      row.subsystem,
      row.controlRole,
      row.application,
      row.schemaSlotId,
      row.fdvRole,
      row.inMpcControl ? "1" : "0",
      row.inUMeas ? "1" : "0",
      row.inEval ? "1" : "0",
      row.catalogOnly ? "1" : "0",
    ]
      .map((value) => csvEscape(String(value)))
      .join(","),
  );

  const outPath = resolve(outDir, "signal_registry.csv");
  await writeFile(outPath, `${header}\n${body.join("\n")}\n`, "utf8");

  const physical = rows.filter((row) => !row.catalogOnly).length;
  const appendix = rows.filter((row) => row.catalogOnly).length;
  const mapped = rows.filter((row) => !row.catalogOnly && row.canonicalId).length;

  console.log(
    `[export-signal-registry] skrev ${outPath} (${rows.length} rader: ${physical} punkter, ${mapped} mapped, ${appendix} catalog-only)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
