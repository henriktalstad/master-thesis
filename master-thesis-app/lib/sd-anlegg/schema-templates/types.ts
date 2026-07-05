import type { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import type { SdComponentType } from "../component-types";

export type TemplateLane =
  | "supply"
  | "exhaust"
  | "heat_recovery"
  | "heating"
  | "status";

/** Sifferkonvensjon for utstyrskoder (501=tilluft, 401/402=avtrekk, …). */
export type EquipmentLanePolicy = TemplateLane;

export type BindingRule =
  | {
      kind: "equipmentCode";
      prefix: string;
      lane: EquipmentLanePolicy;
    }
  | {
      kind: "equipmentDigits";
      prefix: string;
      digits: string;
      /** Tillat binding på tvers av elementKey (f.eks. RT901 fra 320.001). */
      allowCrossElement?: boolean;
    }
  | {
      kind: "signalRole";
      equipmentPrefix: string;
      suffix: string;
    }
  | {
      kind: "oeSuffix";
      suffix: string;
      allowCrossElement?: boolean;
    }
  | {
      kind: "namedSignal";
      patterns: readonly string[];
      /** Tillat binding på tvers av elementKey (f.eks. settpunkt på 310.001 for krets 320.002). */
      allowCrossElement?: boolean;
    }
  | {
      kind: "anyOf";
      rules: readonly BindingRule[];
    };

export type TemplateNodeDef = {
  id: string;
  role: string;
  lane: TemplateLane;
  componentType: SdComponentType;
  label: string;
  bind: BindingRule;
  /** Fallback rekkefølge når mal-kanter mangler i layout. */
  displayOrder?: number;
};

export type TemplateEdgeDef = {
  source: string;
  target: string;
  edgeType?: "duct" | "pipe";
};

export type SchemaTemplate = {
  id: string;
  version: number;
  name: string;
  domains: readonly InfraspawnSystemDomain[];
  /** Valgfri element-nøkkel (320002, 360102) for instans-scoping. */
  elementKeyHint?: readonly string[];
  nodes: readonly TemplateNodeDef[];
  edges: readonly TemplateEdgeDef[];
};

export type TemplateResolveContext = {
  domain?: InfraspawnSystemDomain;
  unitKey?: string;
  scopeId?: string;
  elementKey?: string | null;
};

export type TemplateBindingResult = {
  template: SchemaTemplate;
  layoutSource: "template";
  boundRoleCount: number;
  unboundRoleIds: string[];
};
