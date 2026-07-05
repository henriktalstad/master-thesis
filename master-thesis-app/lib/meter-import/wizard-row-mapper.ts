import type {
  ImportRowAction,
  WizardImportRow,
} from "@/actions/meter-import-wizard";
import type { ExecuteImportRow } from "@/actions/meter-import-execute";
import { isTenantBillableMeter } from "@/lib/energy-flow/tenant-billing";

export function wizardRowToExecuteRow(
  row: WizardImportRow,
  override?: { action?: ImportRowAction },
): ExecuteImportRow {
  return {
    tempId: row.tempId,
    action: override?.action ?? row.suggestedAction,
    mpid: row.mpid,
    name: row.name,
    type: row.type,
    existingMeterId: row.existingMatch?.meterId ?? null,
    flowStage: row.flowStage,
    hierarchyRole: row.hierarchyRole,
    ctPlacement: row.ctPlacement,
    isSubMeter: row.isSubMeter,
    meterLocation: row.meterLocation,
    externalId: row.externalId,
    subMeterCategory: row.subMeterCategory,
    subMeterSubCategory: row.subMeterSubCategory,
    subMeterLabel: row.subMeterLabel,
    parentTempId: row.parentTempId,
    energySourcedFromTempId: row.energySourcedFromTempId,
    parentSelectionConfirmed: row.parentSelectionConfirmed ?? null,
    energySourceSelectionConfirmed: row.energySourceSelectionConfirmed ?? null,
    classificationConfident: row.classificationConfident,
    classificationReason: row.classificationReason,
    verificationStatus: row.verificationStatus ?? "AUTO",
    isTenantBillable:
      row.isTenantBillable ??
      row.customerIntent?.isTenantBillable ??
      isTenantBillableMeter({
        flowStage: row.flowStage,
        hierarchyRole: row.hierarchyRole,
      }),
    customerIntentSource: row.customerIntent?.source ?? null,
    customerRoleIntent: row.customerIntent?.roleIntent ?? null,
    customerIntentWarnings:
      row.customerIntent?.warnings?.map((warning) => warning.message) ?? null,
  };
}
