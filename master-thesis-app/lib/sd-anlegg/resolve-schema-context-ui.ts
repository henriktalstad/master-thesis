import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { MPC_U_MEAS_CANONICALS } from "@/services/mpc/mpc-canonicals";
import { sdAnleggDomainHref } from "./anleggsenhet-routes";
import {
  resolveBuildingControlProfile,
  type BuildingControlProfile,
} from "./control/building-control-profile";
import { CONTROL_SIGNAL_CATALOG_360102 } from "./control/control-signal-catalog";
import { resolvePointForCatalogEntry } from "./control/resolve-control-signals";
import { hasHeatingCircuitMeterSignals } from "./heating-slot-control-links";
import {
  HEATING_DISTRICT_SECONDARY_CIRCUIT_ID,
  isAhuProcessSchemaTemplate,
  isHeatingCombinedSchemaTemplate,
} from "./schema-template-ids";

export type SchemaContextLink = {
  href: string;
  label: string;
  hint?: string;
};

export type SchemaContextUi = {
  caption: string | null;
  links: SchemaContextLink[];
};

function countAvailableCanonicals(
  points: readonly InfraspawnPointListItem[],
  canonicalIds: readonly string[],
): number {
  const catalogById = new Map(
    CONTROL_SIGNAL_CATALOG_360102.map((entry) => [entry.canonicalId, entry]),
  );
  let count = 0;
  for (const canonicalId of canonicalIds) {
    const entry = catalogById.get(canonicalId);
    if (entry && resolvePointForCatalogEntry(points, entry)) {
      count += 1;
    }
  }
  return count;
}

function hasMpcControlSignals(
  points: readonly InfraspawnPointListItem[],
): boolean {
  return (
    countAvailableCanonicals(points, MPC_U_MEAS_CANONICALS) >=
    Math.min(3, MPC_U_MEAS_CANONICALS.length)
  );
}

import { controlStyringHref } from "./control/resolve-control-lookback";

function buildAhuContext(
  profile: BuildingControlProfile,
  buildingSlug: string,
  points: readonly InfraspawnPointListItem[],
): SchemaContextUi {
  const links: SchemaContextLink[] = [];
  const uMeasCount = countAvailableCanonicals(points, MPC_U_MEAS_CANONICALS);

  if (hasMpcControlSignals(points)) {
    links.push({
      href: controlStyringHref(buildingSlug, {
        tab: "analyse",
        analysisView: "signaler",
      }),
      label: "MPC-signaler",
      hint: `${uMeasCount}/${MPC_U_MEAS_CANONICALS.length} u_k`,
    });
    links.push({
      href: controlStyringHref(buildingSlug, { tab: "analyse" }),
      label: "Simulering",
      hint: "Kost og komfort",
    });
  } else if (uMeasCount > 0) {
    links.push({
      href: controlStyringHref(buildingSlug, { tab: "oppsett" }),
      label: "Styring",
      hint: `Delvis MPC-data (${uMeasCount}/${MPC_U_MEAS_CANONICALS.length})`,
    });
  }

  if (profile.heatingUnitSlug) {
    links.push({
      href: sdAnleggDomainHref(buildingSlug, "varme", profile.heatingUnitSlug),
      label: "Fjernvarme",
      hint: "Kretssnitt OE001",
    });
  }

  const caption =
    uMeasCount >= MPC_U_MEAS_CANONICALS.length
      ? `MPC-scope: ${profile.ahuLabel}`
      : uMeasCount > 0
        ? `${profile.ahuLabel} — begrenset signaldekning`
        : null;

  return { caption, links };
}

function buildHeatingContext(
  profile: BuildingControlProfile,
  buildingSlug: string,
  points: readonly InfraspawnPointListItem[],
): SchemaContextUi {
  const links: SchemaContextLink[] = [];

  if (hasHeatingCircuitMeterSignals(points)) {
    links.push({
      href: controlStyringHref(buildingSlug, {
        tab: "analyse",
        analysisView: "energi",
      }),
      label: "Energi i simulering",
      hint: "Kretssnitt målt",
    });
  }

  if (profile.ventilationUnitSlug) {
    links.push({
      href: sdAnleggDomainHref(
        buildingSlug,
        "ventilasjon",
        profile.ventilationUnitSlug,
      ),
      label: profile.ahuLabel,
      hint: "MPC-scope",
    });
    links.push({
      href: controlStyringHref(buildingSlug, {
        tab: "analyse",
        analysisView: "signaler",
      }),
      label: "MPC-signaler",
      hint: "Via AHU",
    });
  }

  const caption = hasHeatingCircuitMeterSignals(points)
    ? "Lokal fjernvarme-regulering — energi føres inn i simulering via kretssnitt"
    : "Lokal SD — ingen kretssnitt-signaler funnet";

  return {
    caption: links.length > 0 ? caption : null,
    links,
  };
}

export function resolveSchemaContextUi(input: {
  buildingSlug: string;
  schemaTemplateId?: string | null;
  points: readonly InfraspawnPointListItem[];
}): SchemaContextUi {
  const profile = resolveBuildingControlProfile(input.buildingSlug);
  if (!profile) {
    return { caption: null, links: [] };
  }

  if (isAhuProcessSchemaTemplate(input.schemaTemplateId)) {
    return buildAhuContext(profile, input.buildingSlug, input.points);
  }

  if (
    isHeatingCombinedSchemaTemplate(input.schemaTemplateId) ||
    input.schemaTemplateId === HEATING_DISTRICT_SECONDARY_CIRCUIT_ID
  ) {
    return buildHeatingContext(profile, input.buildingSlug, input.points);
  }

  return { caption: null, links: [] };
}
