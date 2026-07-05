import { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import type { SchemaTemplate } from "../types";

/** TR001 tappevann / forbruksvann 310.001. */
export const HEATING_TAPWATER_DHW: SchemaTemplate = {
  id: "heating.tapwater.dhw",
  version: 1,
  name: "Forbruksvann TR001",
  domains: [InfraspawnSystemDomain.HEATING],
  elementKeyHint: ["310001"],
  nodes: [],
  edges: [],
};
