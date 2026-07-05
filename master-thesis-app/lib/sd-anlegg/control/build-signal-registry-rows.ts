import {
  resolveAhuSignalAliasEntryForPoint,
} from "@/lib/sd-anlegg/ahu-signal-alias-registry";
import { resolveFdvSignalRole } from "@/lib/sd-anlegg/fdv-signal-registry";
import { INFRASPAWN_EXACT_POINT_LABELS } from "@/lib/infraspawn/point-vocabulary";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  MPC_CONTROL_CANONICAL_SET,
  MPC_U_MEAS_CANONICAL_SET,
} from "@/services/mpc/mpc-canonicals";
import { CONTROL_SIGNAL_CATALOG_360102 } from "./control-signal-catalog";
import {
  CONTROL_SIGNAL_SPEC_BY_ID,
  type ControlSignalSpec360102,
} from "./control-signal-registry-360102";
import { resolvePointForCatalogEntryInContext } from "./resolve-control-catalog";
import type { ControlResolveContext } from "./resolve-control-catalog";

export type SignalRegistryRow = {
  objectId: string;
  objectName: string;
  description: string;
  unit: string;
  canonicalId: string;
  canonicalLabel: string;
  kind: string;
  subsystem: string;
  controlRole: string;
  application: string;
  schemaSlotId: string;
  fdvRole: string;
  inMpcControl: boolean;
  inUMeas: boolean;
  inEval: boolean;
  catalogOnly: boolean;
};

function resolveApplication(spec: ControlSignalSpec360102 | undefined): string {
  if (!spec) return "out_of_scope";
  switch (spec.controlRole) {
    case "mpc_actuator":
      return "mpc_actuator";
    case "bms_setpoint":
      return "mpc_setpoint";
    case "plant_measurement":
    case "disturbance":
      return spec.inEvalDataset ? "mpc_plant" : "ui_plant";
    case "constraint":
      return "mpc_constraint";
    case "operational_mode":
      return "ui_mode";
    case "operational_command":
    case "bms_configuration":
      return "mpc_context";
    case "district_actuator":
      return "district_actuator";
    default:
      return "other";
  }
}

function primaryFdvLabel(point: InfraspawnPointListItem): string {
  return (
    resolveFdvSignalRole(point) ??
    INFRASPAWN_EXACT_POINT_LABELS[point.objectName ?? ""] ??
    point.description?.trim() ??
    ""
  );
}

/** Én rad per fysisk punkt + appendix-rader for canonical uten punkt i kilden. */
export function buildSignalRegistryRows(input: {
  points: readonly InfraspawnPointListItem[];
  context?: ControlResolveContext;
}): SignalRegistryRow[] {
  const canonicalByObjectId = new Map<string, string>();

  for (const entry of CONTROL_SIGNAL_CATALOG_360102) {
    const point = resolvePointForCatalogEntryInContext({
      points: input.points,
      entry,
      context: input.context,
    });
    if (!point?.objectId) continue;
    if (!canonicalByObjectId.has(point.objectId)) {
      canonicalByObjectId.set(point.objectId, entry.canonicalId);
    }
  }

  const pointRows: SignalRegistryRow[] = input.points.map((point) => {
    const canonicalId = canonicalByObjectId.get(point.objectId) ?? "";
    const spec = canonicalId
      ? CONTROL_SIGNAL_SPEC_BY_ID.get(canonicalId)
      : undefined;
    const alias = resolveAhuSignalAliasEntryForPoint(point);

    return {
      objectId: point.objectId,
      objectName: point.objectName ?? "",
      description: point.description ?? "",
      unit: point.unit ?? "",
      canonicalId,
      canonicalLabel: spec?.label ?? "",
      kind: spec?.kind ?? (canonicalId ? "mapped" : "unmapped"),
      subsystem: spec?.subsystem ?? "",
      controlRole: spec?.controlRole ?? "",
      application: resolveApplication(spec),
      schemaSlotId: alias?.slotId ?? "",
      fdvRole: alias?.description || primaryFdvLabel(point),
      inMpcControl: canonicalId
        ? MPC_CONTROL_CANONICAL_SET.has(canonicalId)
        : false,
      inUMeas: canonicalId
        ? MPC_U_MEAS_CANONICAL_SET.has(canonicalId)
        : false,
      inEval: spec?.inEvalDataset ?? false,
      catalogOnly: false,
    };
  });

  const appendix: SignalRegistryRow[] = CONTROL_SIGNAL_CATALOG_360102.filter(
    (entry) =>
      !resolvePointForCatalogEntryInContext({
        points: input.points,
        entry,
        context: input.context,
      }),
  ).map((entry) => {
    const spec = CONTROL_SIGNAL_SPEC_BY_ID.get(entry.canonicalId);
    return {
      objectId: "",
      objectName: entry.influxPatterns[0] ?? "",
      description: entry.expectedMissing ? "forventet manglende i SD" : "",
      unit: spec?.unit ?? "",
      canonicalId: entry.canonicalId,
      canonicalLabel: entry.label,
      kind: entry.kind,
      subsystem: entry.subsystem,
      controlRole: spec?.controlRole ?? "",
      application: resolveApplication(spec),
      schemaSlotId: "",
      fdvRole: entry.label,
      inMpcControl: MPC_CONTROL_CANONICAL_SET.has(entry.canonicalId),
      inUMeas: MPC_U_MEAS_CANONICAL_SET.has(entry.canonicalId),
      inEval: spec?.inEvalDataset ?? false,
      catalogOnly: true,
    };
  });

  return [...pointRows, ...appendix];
}
