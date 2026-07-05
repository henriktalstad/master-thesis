import { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import type { SchemaTemplate } from "../types";

/** Pumpekum 310.010 — Bygg A/B dykkpumper. */
export const HEATING_SUMP_PITS: SchemaTemplate = {
  id: "heating.sump_pits",
  version: 1,
  name: "Pumpekummer",
  domains: [InfraspawnSystemDomain.HEATING],
  elementKeyHint: ["310010"],
  nodes: [],
  edges: [],
};
