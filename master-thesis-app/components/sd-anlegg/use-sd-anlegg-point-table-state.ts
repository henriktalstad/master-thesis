"use client";

import { useMemo } from "react";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import {
  type DomainPointListFilterId,
  buildDomainPointSections,
  buildTemplatePointClassification,
  filterPointsByDomainListFilter,
  listDomainPointListFilters,
  resolveDomainPointListFilterMode,
  resolveDomainPointListFilterSelection,
  usesDomainPointSections,
} from "@/lib/infraspawn/domain-point-list-filters";
import type { SchemaTemplate } from "@/lib/sd-anlegg/schema-templates/types";
import { buildAhuPresentationModel } from "@/lib/sd-anlegg/ahu-equipment-identification";
import { resolveSdAnleggPointLocationLabel } from "@/lib/sd-anlegg/resolve-point-location-label";
import type { ResolvedSdAnleggSiteProfile } from "@/lib/sd-anlegg/site-profile-schema";
import { sdAnleggPointKey } from "./sd-anlegg-point-key";

type Input = {
  points: InfraspawnPointListItem[];
  domain?: InfraspawnSystemDomain;
  schemaTemplate?: SchemaTemplate | null;
  elementKey?: string | null;
  search: string;
  category: DomainPointListFilterId;
  selectedKeys: string[];
  maxSelected: number;
  profile: ResolvedSdAnleggSiteProfile | null;
  canEditProfile: boolean;
  schemaSlotOverrides: ReadonlyMap<string, string>;
};

export function useSdAnleggPointTableState({
  points,
  domain,
  schemaTemplate,
  elementKey,
  search,
  category,
  selectedKeys,
  maxSelected,
  profile,
  canEditProfile,
  schemaSlotOverrides,
}: Input) {
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const showLocationColumn = useMemo(() => {
    if (canEditProfile) return true;
    if (!profile) return false;
    return points.some(
      (point) =>
        resolveSdAnleggPointLocationLabel({
          sourceId: point.sourceId,
          objectId: point.objectId,
          profile,
          point,
          relatedPoints: points,
        }) != null,
    );
  }, [canEditProfile, points, profile]);

  const tableColSpan = showLocationColumn ? 6 : 5;
  const isAhuProcessTemplate =
    schemaTemplate?.id === "ventilation.ahu.dual_duct_hru";

  const ahuPresentationModel = useMemo(
    () =>
      isAhuProcessTemplate
        ? buildAhuPresentationModel(points, {
            elementKey: elementKey ?? null,
            schemaSlotOverrides,
          })
        : null,
    [isAhuProcessTemplate, points, elementKey, schemaSlotOverrides],
  );

  const templateClassification = useMemo(() => {
    if (
      resolveDomainPointListFilterMode(domain, schemaTemplate) !== "template" ||
      !schemaTemplate
    ) {
      return null;
    }
    return buildTemplatePointClassification(points, schemaTemplate, elementKey);
  }, [domain, points, schemaTemplate, elementKey]);

  const visibleCategories = useMemo(
    () =>
      listDomainPointListFilters(
        domain,
        points,
        schemaTemplate,
        elementKey,
        templateClassification ?? undefined,
      ),
    [domain, points, schemaTemplate, elementKey, templateClassification],
  );

  const activeCategory = useMemo(
    () =>
      resolveDomainPointListFilterSelection(
        domain,
        category,
        visibleCategories,
        schemaTemplate,
      ),
    [domain, category, visibleCategories, schemaTemplate],
  );

  const categoryFiltered = useMemo(
    () =>
      filterPointsByDomainListFilter(
        points,
        domain,
        activeCategory,
        schemaTemplate,
        elementKey,
        templateClassification ?? undefined,
      ),
    [
      points,
      domain,
      activeCategory,
      schemaTemplate,
      elementKey,
      templateClassification,
    ],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categoryFiltered;
    return categoryFiltered.filter((p) => {
      const haystack = [
        p.objectName,
        p.description,
        p.objectId,
        p.sourceLabel,
        p.unit,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [categoryFiltered, search]);

  const sectionedRows = useMemo(() => {
    if (
      !usesDomainPointSections(domain, activeCategory, schemaTemplate) ||
      search.trim() ||
      !schemaTemplate
    ) {
      return null;
    }
    return buildDomainPointSections(
      filtered,
      schemaTemplate,
      elementKey,
      templateClassification ?? undefined,
    );
  }, [
    domain,
    activeCategory,
    filtered,
    search,
    schemaTemplate,
    elementKey,
    templateClassification,
  ]);

  const filteredKeys = useMemo(
    () => filtered.map((p) => sdAnleggPointKey(p)),
    [filtered],
  );
  const allFilteredSelected =
    filteredKeys.length > 0 &&
    filteredKeys.every((key) => selectedSet.has(key));
  const someFilteredSelected =
    !allFilteredSelected && filteredKeys.some((key) => selectedSet.has(key));
  const atMax = selectedKeys.length >= maxSelected;

  return {
    selectedSet,
    showLocationColumn,
    tableColSpan,
    ahuPresentationModel,
    visibleCategories,
    activeCategory,
    templateClassification,
    filtered,
    sectionedRows,
    filteredKeys,
    allFilteredSelected,
    someFilteredSelected,
    atMax,
  };
}
