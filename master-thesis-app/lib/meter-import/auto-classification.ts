import type {
  CtPlacement,
  EnergyFlowStage,
  MeterHierarchyRole,
} from "@/generated/client";
import {
  classifyMeter,
  type ClassificationResult,
} from "@/lib/energy-flow/classification-rules";
import {
  applyMeterTypeCorrectionForRoleIntent,
  mapRoleIntentToClassification,
} from "@/lib/energy-flow/meter-role-intent";
import type { TransformedRow } from "./row-transformer";
import type { ResolvedTopology, RowWithTempId } from "./topology-resolver";


export type ClassificationSource =
  | "tag"
  | "tag-partial"
  | "name"
  | "customer"
  | "default"
  | "manual";

export type AutoClassifiedRow = TransformedRow & {
  tempId: string;

  parentTempId: string | null;
  energySourcedFromTempId: string | null;

  flowStage: EnergyFlowStage | null;
  hierarchyRole: MeterHierarchyRole | null;
  ctPlacement: CtPlacement | null;

  classificationConfident: boolean;
  classificationReason: string;
  classificationSource: ClassificationSource;
};

export type AutoClassificationSummary = {
  total: number;
  confident: number;
  needsReview: number;
  parentLinked: number;
  energySourceLinked: number;
  bySource: Record<ClassificationSource, number>;
};

export type AutoClassificationResult = {
  rows: AutoClassifiedRow[];
  summary: AutoClassificationSummary;
};


export function autoClassifyRows(
  rows: RowWithTempId[],
  topology: ResolvedTopology,
): AutoClassificationResult {
  const summary: AutoClassificationSummary = {
    total: rows.length,
    confident: 0,
    needsReview: 0,
    parentLinked: 0,
    energySourceLinked: 0,
    bySource: {
      tag: 0,
      "tag-partial": 0,
      name: 0,
      customer: 0,
      default: 0,
      manual: 0,
    },
  };

  const classifiedRows: AutoClassifiedRow[] = rows.map((row) => {
    const resolved = topology.perRow.get(row.tempId);
    const parentTempId = resolved?.parentTempId ?? null;
    const energySourcedFromTempId = resolved?.energySourcedFromTempId ?? null;
    const hasChildren = resolved?.hasChildren ?? false;

    const effectiveIsSubMeter = row.isSubMeter || parentTempId !== null;

    const customerIntent = row.customerIntent;
    const useCustomerIntent =
      Boolean(customerIntent?.roleIntent) &&
      customerIntent?.roleIntent !== "unknown" &&
      customerIntent?.typeCompatibility !== "incompatible";
    const resolvedType =
      useCustomerIntent && customerIntent?.roleIntent
        ? applyMeterTypeCorrectionForRoleIntent(
            customerIntent.roleIntent,
            row.type,
          )
        : row.type;

    const fallbackClassification: ClassificationResult = classifyMeter({
      type: resolvedType,
      isSubMeter: effectiveIsSubMeter,
      subMeterCategory: row.subMeterCategory,
      subMeterSubCategory: row.subMeterSubCategory,
      name: row.name,
      hasChildren,
      parentId: parentTempId,
      meteringTopology: topology.buildingTopology,
    });

    const mappedCustomer = useCustomerIntent
      ? mapRoleIntentToClassification(customerIntent!.roleIntent!, {
          hasChildren:
            hasChildren || customerIntent?.hierarchyHint === "BRANCH",
          currentType: resolvedType,
        })
      : null;
    const classification: ClassificationResult = mappedCustomer
      ? {
          flowStage: mappedCustomer.flowStage,
          hierarchyRole:
            customerIntent?.hierarchyHint ?? mappedCustomer.hierarchyRole,
          ctPlacement: mappedCustomer.ctPlacement,
          confident:
            (customerIntent?.roleIntentConfidence ?? 0) >= 0.75 &&
            customerIntent?.importStatus !== "needs_review" &&
            customerIntent?.importStatus !== "skip",
          reason:
            customerIntent?.roleIntentReason ??
            `Klassifisert fra masterlistevalg: ${customerIntent?.roleIntent}`,
          suggestedParentId: fallbackClassification.suggestedParentId,
          suggestedEnergySourcedFromId:
            fallbackClassification.suggestedEnergySourcedFromId,
          groupReviewReason: fallbackClassification.groupReviewReason,
          roleIntent: customerIntent!.roleIntent!,
          standardHint: fallbackClassification.standardHint,
        }
      : fallbackClassification;

    const source = mappedCustomer ? "customer" : pickSource(row, classification);
    summary.bySource[source]++;

    if (classification.confident) summary.confident++;
    else summary.needsReview++;
    if (parentTempId) summary.parentLinked++;
    if (energySourcedFromTempId) summary.energySourceLinked++;

    return {
      ...row,
      type: resolvedType,
      parentTempId,
      energySourcedFromTempId,
      flowStage: classification.flowStage,
      hierarchyRole: classification.hierarchyRole,
      ctPlacement: classification.ctPlacement,
      classificationConfident: classification.confident,
      classificationReason: composeReason(
        classification.reason,
        resolved?.parentReason,
        resolved?.energySourceReason,
        customerIntent?.typeCompatibility === "incompatible"
          ? "Målertype og masterlistevalg er ikke kompatible."
          : null,
      ),
      classificationSource: source,
      isSubMeter: effectiveIsSubMeter,
    };
  });

  return { rows: classifiedRows, summary };
}


function pickSource(
  row: TransformedRow,
  classification: ClassificationResult,
): ClassificationSource {
  if (row.parsedTag) {
    if (
      row.parsedTag.matchKind === "full" ||
      row.parsedTag.matchKind === "short"
    ) {
      return "tag";
    }
    return "tag-partial";
  }

  const r = classification.reason.toLowerCase();
  if (
    r.includes("hovedfordeling") ||
    r.includes("varmepumpe") ||
    r.includes("el-kjel") ||
    r.includes("varmepumpe-produksjon") ||
    r.includes("solceller") ||
    r.includes("ventil") ||
    r.includes("gulv")
  ) {
    return "name";
  }

  return "default";
}

function composeReason(
  classificationReason: string,
  parentReason: string | null | undefined,
  energySourceReason: string | null | undefined,
  extraReason?: string | null,
): string {
  const parts: string[] = [classificationReason];
  if (parentReason) parts.push(`Parent: ${parentReason}`);
  if (energySourceReason) parts.push(`Energi-kilde: ${energySourceReason}`);
  if (extraReason) parts.push(extraReason);
  return parts.join(" ");
}
