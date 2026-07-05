import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { NAERBYEN_AUDIT_FIXTURES } from "./fixtures/naerbyen-audit-fixtures";
import { resolveTemplateBindings } from "./schema-templates/resolve-template-bindings";
import { VENTILATION_AHU_DUAL_DUCT_HRU } from "./schema-templates/templates/ventilation.ahu.dual_duct_hru";
import type { SdLayout } from "./layout-schema";

export function naerbyenAuditFixturePoints(
  sourceId = "s1",
): InfraspawnPointListItem[] {
  return NAERBYEN_AUDIT_FIXTURES.map((fixture) => ({
    sourceId,
    sourceLabel: "360.102",
    objectId: fixture.objectId,
    objectName: fixture.objectName,
    description: fixture.description,
    unit: fixture.unit,
    lastValue: 1,
    lastSampledAt: "2026-06-19T12:00:00.000Z",
    valueSource: "postgres-sync" as const,
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
  }));
}

/** Seed/test-inngang for ventilasjonsskjema fra mal. */
export function buildNaerbyenSdAnleggSeedLayout(
  sourceId: string,
  points: readonly InfraspawnPointListItem[] = naerbyenAuditFixturePoints(
    sourceId,
  ),
): SdLayout {
  return resolveTemplateBindings(
    VENTILATION_AHU_DUAL_DUCT_HRU,
    points,
    "360102",
  ).layout;
}

export { VENTILATION_AHU_DUAL_DUCT_HRU as NAERBYEN_VENTILATION_TEMPLATE };
