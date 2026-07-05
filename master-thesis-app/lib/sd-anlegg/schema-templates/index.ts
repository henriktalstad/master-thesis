export type {
  BindingRule,
  EquipmentLanePolicy,
  SchemaTemplate,
  TemplateBindingResult,
  TemplateEdgeDef,
  TemplateLane,
  TemplateNodeDef,
  TemplateResolveContext,
} from "./types";

export {
  equipmentCodeMatchesLane,
  prefixMatchesEquipmentCode,
} from "./equipment-lane-policy";

export {
  findBestBindingRuleMatch,
  scoreBindingRuleMatch,
} from "./match-binding-rule";

export { resolveTemplateBindings } from "./resolve-template-bindings";

export {
  SCHEMA_TEMPLATES,
  getSchemaTemplateById,
  inferElementKeyFromPoints,
  inferElementKeyFromUnitKey,
  parseScopeId,
  resolveElementKeyForScope,
  resolveSchemaTemplateForScope,
} from "./resolve-template-for-scope";

export { VENTILATION_AHU_DUAL_DUCT_HRU } from "./templates/ventilation.ahu.dual_duct_hru";
export { HEATING_DISTRICT_SECONDARY_CIRCUIT } from "./templates/heating.district.secondary_circuit";

export {
  CURATED_POINT_LIST_GROUP_LABELS,
  CURATED_POINT_LIST_GROUPS,
  CURATED_POINT_LIST_SECTION_ORDER,
  type CuratedPointListGroup,
  type CuratedPointSection,
  buildTemplatePointLaneMap,
  classifyTemplatePoint,
  countTemplatePointsByGroup,
  filterTemplatePointsByGroup,
  groupTemplatePointsIntoSections,
  listVisibleTemplatePointGroups,
  resolveTemplatePointGroupSelection,
} from "./list-point-groups";
