export {
  parseFileBuffer,
  parseExcelBuffer,
  parseCsvString,
  getSampleRows,
  getUniqueColumnValues,
  normalizeHeader,
  type RawImportRow,
  type ParseResult,
  type ParseError,
  type MeterImportParseResult,
} from "./parser";

export {
  detectMeterType,
  detectMeterTypeFromName,
  detectIsSubMeter,
  meterTypeLabel,
  ALL_METER_TYPES,
  type TypeDetectionResult,
} from "./type-detector";

export {
  autoMapColumns,
  applyUserMapping,
  validateMappings,
  MAPPABLE_FIELD_META,
  type MappableField,
  type ColumnMapping,
  type ColumnMappingResult,
} from "./column-mapper";

export {
  transformRows,
  updateTransformedRow,
  type TransformedRow,
  type TransformResult,
  type TransformSummary,
  type ImportIssue,
} from "./row-transformer";

export {
  resolveTopology,
  ensureTempIds,
  isExistingParentTempId,
  unwrapExistingParentTempId,
  EXISTING_PARENT_PREFIX,
  type RowWithTempId,
  type ResolvedTopology,
  type ResolvedTopologyForRow,
  type ExistingMeterCandidate,
  type ResolveTopologyOptions,
} from "./topology-resolver";

export {
  autoClassifyRows,
  type AutoClassifiedRow,
  type AutoClassificationSummary,
  type ClassificationSource,
} from "./auto-classification";

export { wizardRowToExecuteRow } from "./wizard-row-mapper";
