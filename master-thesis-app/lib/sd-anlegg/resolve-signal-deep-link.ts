import {
  inferInfraspawnSystemDomain,
  systemDomainToPathSegment,
  type InfraspawnSystemDomain,
} from "@/lib/infraspawn/system-domain";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { sdAnleggDomainHref, type SdAnleggDomainSegment } from "./anleggsenhet-routes";
import {
  filterPointsForAnleggsenhet,
  inferAnleggsenheterFromPoints,
  type SdAnleggsenhet,
} from "./infer-anleggsenheter";

export type SignalDeepLinkTarget = {
  href: string;
  label: string;
  domain: InfraspawnSystemDomain;
  unitSlug: string | null;
};

function findUnitForPoint(
  point: Pick<InfraspawnPointListItem, "sourceId" | "objectId">,
  points: readonly InfraspawnPointListItem[],
  sources: readonly { id: string; label: string }[],
): SdAnleggsenhet | null {
  const { units } = inferAnleggsenheterFromPoints(points, sources);
  for (const unit of units) {
    const scoped = filterPointsForAnleggsenhet(points, unit);
    if (
      scoped.some(
        (candidate) =>
          candidate.sourceId === point.sourceId &&
          candidate.objectId === point.objectId,
      )
    ) {
      return unit;
    }
  }
  return null;
}

export function resolveSignalDeepLink(input: {
  buildingSlug: string;
  sourceId: string;
  objectId: string;
  points: readonly InfraspawnPointListItem[];
  sources: readonly { id: string; label: string }[];
  view?: "schema" | "list";
}): SignalDeepLinkTarget | null {
  const point = input.points.find(
    (candidate) =>
      candidate.sourceId === input.sourceId &&
      candidate.objectId === input.objectId,
  );
  if (!point) return null;

  const domain = inferInfraspawnSystemDomain(point);
  const rawSegment = systemDomainToPathSegment(domain);
  const segment: SdAnleggDomainSegment =
    rawSegment === "ventilasjon" || rawSegment === "varme" || rawSegment === "annet"
      ? rawSegment
      : "annet";
  const unit = findUnitForPoint(point, input.points, input.sources);
  const unitSlug = unit?.slug ?? null;

  const params = new URLSearchParams();
  params.set("view", input.view ?? "schema");
  params.set("point", `${point.sourceId}:${point.objectId}`);

  const base = unitSlug
    ? sdAnleggDomainHref(input.buildingSlug, segment, unitSlug)
    : sdAnleggDomainHref(input.buildingSlug, segment);

  return {
    href: `${base}?${params.toString()}`,
    label: unit?.displayName ?? segment,
    domain,
    unitSlug,
  };
}

export function parseWorkspacePointParam(
  param: string | null | undefined,
): { sourceId: string; objectId: string } | null {
  if (!param?.trim()) return null;
  const colon = param.indexOf(":");
  if (colon <= 0 || colon >= param.length - 1) return null;
  return {
    sourceId: param.slice(0, colon),
    objectId: param.slice(colon + 1),
  };
}
