import { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import type { SchemaTemplate } from "../types";

/** Samlet 320.001-3 fjernvarme — bolig- og næringsgren i ett skjema. */
export const HEATING_DISTRICT_COMBINED: SchemaTemplate = {
  id: "heating.district.combined",
  version: 1,
  name: "Fjernvarme 320.001-3",
  domains: [InfraspawnSystemDomain.HEATING],
  elementKeyHint: ["3200013"],
  nodes: [],
  edges: [],
};
