import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  CONTROL_SIGNAL_CATALOG_360102,
  CONTROL_SUBSYSTEM_LABELS,
} from "./control-signal-catalog";
import type {
  ControlDataQuality,
  ControlPlantModel,
  ControlPlantSubsystem,
  ControlSignalKind,
  ControlSubsystem,
} from "./control-types";
import type { ControlResolveContext } from "./resolve-control-catalog";
import {
  catalogCoveragePct,
  missingCriticalSignalLabels,
  resolveControlSignalsForCatalog,
} from "./resolve-control-signals";

const SUBSYSTEM_ORDER: ControlSubsystem[] = [
  "ventilation",
  "heating",
  "cooling",
  "district_heating",
  "temperature",
  "system",
  "energy",
];

function groupSignalsBySubsystem(
  signals: ReturnType<typeof resolveControlSignalsForCatalog>,
): ControlPlantSubsystem[] {
  const bySubsystem = new Map<ControlSubsystem, ControlPlantSubsystem>();

  for (const subsystem of SUBSYSTEM_ORDER) {
    bySubsystem.set(subsystem, {
      id: subsystem,
      label: CONTROL_SUBSYSTEM_LABELS[subsystem],
      controls: [],
      states: [],
      constraints: [],
    });
  }

  for (const signal of signals) {
    const bucket = bySubsystem.get(signal.catalog.subsystem);
    if (!bucket) continue;

    const kind: ControlSignalKind = signal.catalog.kind;
    if (kind === "control") {
      bucket.controls.push(signal);
    } else if (kind === "constraint") {
      bucket.constraints.push(signal);
    } else {
      bucket.states.push(signal);
    }
  }

  return SUBSYSTEM_ORDER.flatMap((id) => {
    const subsystem = bySubsystem.get(id)!;
    if (
      subsystem.controls.length === 0 &&
      subsystem.states.length === 0 &&
      subsystem.constraints.length === 0
    ) {
      return [];
    }
    return [subsystem];
  });
}

export function buildControlPlantModel(input: {
  buildingId: string;
  buildingName: string;
  unitKey?: string;
  points: readonly InfraspawnPointListItem[];
  resolveContext?: ControlResolveContext;
  dataQuality: Omit<
    ControlDataQuality,
    "sdPointCount" | "catalogCoveragePct" | "missingCritical"
  >;
}): ControlPlantModel {
  const signals = resolveControlSignalsForCatalog(
    input.points,
    CONTROL_SIGNAL_CATALOG_360102,
    input.resolveContext,
  );
  const missingCritical = missingCriticalSignalLabels(signals);
  const warnings: string[] = [];

  const expectedMissingCount = signals.filter(
    (s) => s.availability === "expected_missing",
  ).length;
  if (expectedMissingCount > 0) {
    warnings.push(
      `${expectedMissingCount} forventede signaler mangler i SD-eksporten.`,
    );
  }
  if (input.dataQuality.energyHourCount < 24) {
    warnings.push("Lite energihistorikk — simulering blir grovere.");
  }
  if (input.dataQuality.weatherHourCount < 24) {
    warnings.push("Lite værdata — temperaturrespons blir mindre presis.");
  }

  return {
    buildingId: input.buildingId,
    buildingName: input.buildingName,
    unitKey: input.unitKey ?? "360.102",
    subsystems: groupSignalsBySubsystem(signals),
    dataQuality: {
      ...input.dataQuality,
      sdPointCount: input.points.length,
      catalogCoveragePct: catalogCoveragePct(signals),
      missingCritical,
      warnings,
    },
  };
}

export function flattenPlantSignals(
  model: ControlPlantModel,
): ReturnType<typeof resolveControlSignalsForCatalog> {
  return model.subsystems.flatMap((subsystem) => [
    ...subsystem.controls,
    ...subsystem.states,
    ...subsystem.constraints,
  ]);
}
