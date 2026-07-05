import { InfraspawnSystemDomain } from "@/generated/client/enums";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  INFRASPAWN_POINT_CATEGORIES,
  INFRASPAWN_POINT_CATEGORY_LABELS,
  type InfraspawnPointCategory,
  classifyInfraspawnPoint,
  countInfraspawnPointsByCategory,
  filterInfraspawnPointsByCategory,
  resolveInfraspawnPointCategorySelection,
} from "@/lib/infraspawn/point-classification";
import {
  CURATED_POINT_LIST_GROUP_LABELS,
  type CuratedPointListGroup,
  type CuratedPointSection,
  type TemplatePointClassification,
  buildTemplatePointClassification,
  filterTemplatePointsByGroup,
  groupTemplatePointsIntoSections,
  listVisibleTemplatePointGroups,
  resolveTemplatePointGroupSelection,
} from "@/lib/sd-anlegg/schema-templates/list-point-groups";

export { buildTemplatePointClassification } from "@/lib/sd-anlegg/schema-templates/list-point-groups";
import type { SchemaTemplate } from "@/lib/sd-anlegg/schema-templates/types";

export type DomainPointListFilterId =
  | InfraspawnPointCategory
  | CuratedPointListGroup;

export type DomainPointListFilterMode = "category" | "template";

export type DomainPointListFilterState =
  | { mode: "category"; id: InfraspawnPointCategory }
  | { mode: "template"; id: CuratedPointListGroup };

export type { CuratedPointSection as DomainPointListSection };

function listDefaultPointListFilters(
  points: readonly InfraspawnPointListItem[],
): InfraspawnPointCategory[] {
  const counts = countInfraspawnPointsByCategory(points);
  return INFRASPAWN_POINT_CATEGORIES.filter(
    (category) => category === "all" || counts[category] > 0,
  );
}

function isSchemaTemplateDomain(
  domain: InfraspawnSystemDomain | undefined,
  schemaTemplate?: SchemaTemplate | null,
): schemaTemplate is SchemaTemplate {
  return (
    (domain === InfraspawnSystemDomain.VENTILATION ||
      domain === InfraspawnSystemDomain.HEATING) &&
    schemaTemplate != null
  );
}

export function resolveDomainPointListFilterMode(
  domain: InfraspawnSystemDomain | undefined,
  schemaTemplate?: SchemaTemplate | null,
): DomainPointListFilterMode {
  return isSchemaTemplateDomain(domain, schemaTemplate) ? "template" : "category";
}

export function toDomainPointListFilterState(
  domain: InfraspawnSystemDomain | undefined,
  filterId: DomainPointListFilterId,
  schemaTemplate?: SchemaTemplate | null,
): DomainPointListFilterState {
  const mode = resolveDomainPointListFilterMode(domain, schemaTemplate);
  return mode === "template"
    ? { mode: "template", id: filterId as CuratedPointListGroup }
    : { mode: "category", id: filterId as InfraspawnPointCategory };
}

export function listDomainPointListFilters(
  domain: InfraspawnSystemDomain | undefined,
  points: readonly InfraspawnPointListItem[],
  schemaTemplate?: SchemaTemplate | null,
  elementKey?: string | null,
  classification?: TemplatePointClassification,
): DomainPointListFilterId[] {
  if (isSchemaTemplateDomain(domain, schemaTemplate)) {
    return listVisibleTemplatePointGroups(
      points,
      schemaTemplate,
      elementKey,
      classification,
    );
  }
  return listDefaultPointListFilters(points);
}

export function labelForDomainPointListFilter(
  filterState: DomainPointListFilterState,
): string {
  return filterState.mode === "template"
    ? CURATED_POINT_LIST_GROUP_LABELS[filterState.id]
    : INFRASPAWN_POINT_CATEGORY_LABELS[filterState.id];
}

export function resolveDomainPointListFilterSelection(
  domain: InfraspawnSystemDomain | undefined,
  selected: DomainPointListFilterId,
  visible: readonly DomainPointListFilterId[],
  schemaTemplate?: SchemaTemplate | null,
): DomainPointListFilterId {
  const state = toDomainPointListFilterState(domain, selected, schemaTemplate);
  if (state.mode === "template") {
    return resolveTemplatePointGroupSelection(
      state.id,
      visible as CuratedPointListGroup[],
    );
  }
  return resolveInfraspawnPointCategorySelection(
    state.id,
    visible as InfraspawnPointCategory[],
  );
}

export function filterPointsByDomainListFilter(
  points: readonly InfraspawnPointListItem[],
  domain: InfraspawnSystemDomain | undefined,
  filterId: DomainPointListFilterId,
  schemaTemplate?: SchemaTemplate | null,
  elementKey?: string | null,
  classification?: TemplatePointClassification,
): InfraspawnPointListItem[] {
  const state = toDomainPointListFilterState(domain, filterId, schemaTemplate);
  if (state.mode === "template" && schemaTemplate) {
    return filterTemplatePointsByGroup(
      points,
      schemaTemplate,
      state.id,
      elementKey,
      classification,
    );
  }
  if (state.mode === "category") {
    return filterInfraspawnPointsByCategory(points, state.id);
  }
  return [...points];
}

export function countPointsForDomainListFilter(
  points: readonly InfraspawnPointListItem[],
  domain: InfraspawnSystemDomain | undefined,
  filterId: DomainPointListFilterId,
  schemaTemplate?: SchemaTemplate | null,
  elementKey?: string | null,
  classification?: TemplatePointClassification,
): number {
  const state = toDomainPointListFilterState(domain, filterId, schemaTemplate);
  if (state.mode === "template" && schemaTemplate) {
    const counts =
      classification?.counts ??
      buildTemplatePointClassification(points, schemaTemplate, elementKey).counts;
    return counts[state.id];
  }
  if (state.mode === "category") {
    if (state.id === "all") return points.length;
    return points.filter((point) => classifyInfraspawnPoint(point) === state.id)
      .length;
  }
  return points.length;
}

export function usesDomainPointSections(
  domain: InfraspawnSystemDomain | undefined,
  filterId: DomainPointListFilterId,
  schemaTemplate?: SchemaTemplate | null,
): boolean {
  const state = toDomainPointListFilterState(domain, filterId, schemaTemplate);
  return state.mode === "template" && state.id === "all";
}

export function buildDomainPointSections(
  points: readonly InfraspawnPointListItem[],
  schemaTemplate: SchemaTemplate,
  elementKey?: string | null,
  classification?: TemplatePointClassification,
): CuratedPointSection[] {
  return groupTemplatePointsIntoSections(
    points,
    schemaTemplate,
    elementKey,
    classification,
  );
}

export const DEFAULT_DOMAIN_POINT_LIST_FILTER: DomainPointListFilterId = "all";
