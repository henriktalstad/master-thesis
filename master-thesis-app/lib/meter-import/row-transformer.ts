import type {
  MeteringPointType,
  SubMeterCategory,
  SubMeterSubCategory,
} from "@/generated/client";
import type { RawImportRow } from "./parser";
import type { ColumnMapping, MappableField } from "./column-mapper";
import {
  detectMeterType,
  detectMeterTypeFromName,
  detectIsSubMeter,
} from "./type-detector";
import {
  suggestCategory,
  suggestSubCategory,
  type CategorySuggestion,
} from "@/lib/constants/meter-categories";
import {
  parseKsTag,
  type KsTag,
  type KsElementCategory,
} from "./ks-tag-parser";
import {
  normalizeCustomerIntent,
  type CustomerIntentRawFields,
  type NormalizedCustomerIntent,
} from "./customer-intent-normalizer";


export interface ImportIssue {
  field: string;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface TransformedRow {
  rowIndex: number;
  name: string | null;
  mpid: string | null;
  type: MeteringPointType;
  typeConfidence: number;
  meterLocation: string | null;
  subMeterCategory: SubMeterCategory | null;
  subMeterSubCategory: SubMeterSubCategory | null;
  categoryConfidence: number;
  isSubMeter: boolean;
  parentName: string | null;
  subMeterLabel: string | null;
  floor: string | null;
  block: string | null;
  bus: string | null;
  externalId: string | null;
  tag: string | null;
  parsedTag: KsTag | null;
  groupBlock: string | null;
  customerIntentRaw: CustomerIntentRawFields;
  customerIntent: NormalizedCustomerIntent | null;
  status: "valid" | "warning" | "error";
  issues: ImportIssue[];
  rawCells: Record<string, string>;
}

export interface TransformResult {
  rows: TransformedRow[];
  summary: TransformSummary;
}

export interface TransformSummary {
  totalRows: number;
  valid: number;
  warnings: number;
  errors: number;
  detectedTypes: Record<MeteringPointType, number>;
  detectedCategories: Partial<Record<SubMeterCategory, number>>;
  subMeterCount: number;
}
const MPID_PATTERN = /\b(707057500\d{9})\b/;
const UUID_LIKE_PATTERN =
  /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i;
const BUS_PATTERNS = [
  /\b(M-?BUS)\b/i,
  /\b(Modbus)\b/i,
  /\b(BACnet)\b/i,
  /\b(LON)\b/i,
  /\b(KNX)\b/i,
];
const LOCATION_PATTERNS = [
  /\b(hovedtavle\s*[\d.]+)/i,
  /\b(automatikktavle\s*[\d.]*)/i,
  /\b(fordeling\s*[\d.]+)/i,
  /\b(varmesentral\b)/i,
  /\b(ventilasjonsrom\b)/i,
  /\b(teknisk\s*rom\b)/i,
  /\b(kjeller\b)/i,
  /\b(undersentral\b)/i,
  /\b(tavle\s*[\d.]+)/i,
];
const FLOOR_PATTERN = /\b(\d+)\s*\.?\s*(etg|etasje|plan|floor)\b\.?/i;
const FLOOR_ALT_PATTERN = /\b(etg|etasje|plan|floor)\s*\.?\s*(\d+)\b/i;
const BLOCK_PATTERN =
  /\b(bygg|blokk|block|del|fløy|wing)\s*[:\-]?\s*([A-Z0-9][\w-]*)/i;


export function transformRows(
  rawRows: RawImportRow[],
  mappings: ColumnMapping[],
): TransformResult {
  const fieldToHeader = new Map<MappableField, string>();
  for (const mapping of mappings) {
    if (mapping.field !== "skip") {
      fieldToHeader.set(mapping.field, mapping.normalizedHeader);
    }
  }

  function getValue(row: RawImportRow, field: MappableField): string | null {
    const header = fieldToHeader.get(field);
    if (!header) return null;
    const val = row.cells[header];
    return val && val.trim().length > 0 ? val.trim() : null;
  }

  const rows: TransformedRow[] = [];
  const summary: TransformSummary = {
    totalRows: rawRows.length,
    valid: 0,
    warnings: 0,
    errors: 0,
    detectedTypes: {
      ELECTRICITY: 0,
      HEAT: 0,
      COOLING: 0,
      PRODUCTION: 0,
      WATER: 0,
    },
    detectedCategories: {},
    subMeterCount: 0,
  };

  let carriedGroupBlock: string | null = null;
  let carriedBlock: string | null = null;

  for (const rawRow of rawRows) {
    const issues: ImportIssue[] = [];

    let name = getValue(rawRow, "name");
    let mpid = getValue(rawRow, "mpid");
    const rawType = getValue(rawRow, "type");
    let meterLocation = getValue(rawRow, "meterLocation");
    const parentName = getValue(rawRow, "parentName");
    let floor = getValue(rawRow, "floor");
    let block = getValue(rawRow, "block");
    let bus = getValue(rawRow, "bus");
    let externalId = getValue(rawRow, "externalId");
    const subMeterLabel = getValue(rawRow, "subMeterLabel");
    const isSubMeterField = getValue(rawRow, "isSubMeter");
    const rawTag = getValue(rawRow, "tag");
    const rawGroupBlock = getValue(rawRow, "groupBlock");
    const rawHasData = getValue(rawRow, "hasData");
    const rawRoleIntent = getValue(rawRow, "roleIntent");
    const rawRoleIntentOther = getValue(rawRow, "roleIntentOther");
    const rawEnergySourceName = getValue(rawRow, "energySourceName");
    const rawTenantBillable = getValue(rawRow, "tenantBillable");
    const rawClassificationNotes = getValue(rawRow, "classificationNotes");
    const rawImportStatus = getValue(rawRow, "importStatus");
    const rawHierarchyRole = getValue(rawRow, "hierarchyRole");

    if (rawGroupBlock) {
      carriedGroupBlock = rawGroupBlock;
    }
    if (block) {
      carriedBlock = block;
    } else if (carriedBlock) {
      block = carriedBlock;
    }
    const groupBlock = carriedGroupBlock;

    let tagSource: string | null = rawTag;
    let parsedTag: KsTag | null = parseKsTag(rawTag);

    if (!parsedTag && externalId) {
      const fromExternal = parseKsTag(externalId);
      if (fromExternal) {
        parsedTag = fromExternal;
        tagSource = externalId;
      }
    }

    const allCellValues = Object.values(rawRow.cells).filter(
      (v) => v.length > 0,
    );
    const allCellText = allCellValues.join(" | ");

    if (!parsedTag) {
      for (const v of allCellValues) {
        const candidate = parseKsTag(v);
        if (candidate) {
          parsedTag = candidate;
          tagSource = v;
          break;
        }
      }
    }

    if (!mpid) {
      const mpidMatch = allCellText.match(MPID_PATTERN);
      if (mpidMatch) {
        mpid = mpidMatch[1];
        issues.push({
          field: "mpid",
          severity: "info",
          message: `MPID ${mpid} funnet automatisk fra raddata`,
        });
      }
    }

    if (!externalId) {
      const uuidMatch = allCellText.match(UUID_LIKE_PATTERN);
      if (uuidMatch) {
        if (uuidMatch[1] !== mpid) {
          externalId = uuidMatch[1];
        }
      }
    }

    if (!bus) {
      for (const pattern of BUS_PATTERNS) {
        const match = allCellText.match(pattern);
        if (match) {
          bus = match[1];
          break;
        }
      }
    }

    if (!meterLocation) {
      for (const pattern of LOCATION_PATTERNS) {
        const match = allCellText.match(pattern);
        if (match) {
          meterLocation = match[1];
          break;
        }
      }
    }

    if (!floor) {
      const floorMatch =
        allCellText.match(FLOOR_PATTERN) ??
        allCellText.match(FLOOR_ALT_PATTERN);
      if (floorMatch) {
        const num = floorMatch[1].match(/\d+/) ? floorMatch[1] : floorMatch[2];
        floor = `${num}. etg.`;
      }
    }

    if (!block) {
      const blockMatch = allCellText.match(BLOCK_PATTERN);
      if (blockMatch) {
        block = `${blockMatch[1]} ${blockMatch[2]}`;
      }
    }

    if (!name && mpid) {
      const descriptiveCandidate = allCellValues.find((v) => {
        if (v === mpid) return false;
        if (/^\d+([.,]\d+)?$/.test(v)) return false; // Kun tall
        if (v.length < 3 || v.length > 120) return false;
        if (UUID_LIKE_PATTERN.test(v)) return false; // UUID
        return /[a-zæøå]/i.test(v);
      });
      if (descriptiveCandidate) {
        name = descriptiveCandidate;
        issues.push({
          field: "name",
          severity: "info",
          message: `Navn "${name}" utledet automatisk fra raddata`,
        });
      }
    }


    if (!name && !mpid) {
      issues.push({
        field: "name/mpid",
        severity: "error",
        message: "Verken navn eller MPID er angitt — raden kan ikke importeres",
      });
    }

    const composedLocation = composeMeterLocation(meterLocation, floor, block);

    let typeResult = detectMeterType(rawType);

    if (name && typeResult.confidence < 0.8) {
      const nameTypeResult = detectMeterTypeFromName(name);
      if (nameTypeResult.confidence > typeResult.confidence) {
        typeResult = nameTypeResult;
      }
    }

    if (composedLocation && typeResult.confidence < 0.8) {
      const locTypeResult = detectMeterTypeFromName(composedLocation);
      if (locTypeResult.confidence > typeResult.confidence) {
        typeResult = locTypeResult;
      }
    }

    if (
      parsedTag &&
      parsedTag.elementCategory === "SOLAR_PV" &&
      parsedTag.matchKind !== "element-only"
    ) {
      typeResult = {
        type: "PRODUCTION",
        confidence: 1.0,
        source: "pattern",
        matchedPattern: `ks-tag:${parsedTag.systemCode} (SOLAR_PV — entydig)`,
      };
    } else if (parsedTag && typeResult.confidence < 0.85) {
      const tagTypeHint = meterTypeFromKsCategory(parsedTag.elementCategory);
      if (tagTypeHint) {
        const tagConfidence =
          parsedTag.matchKind === "element-only" ? 0.7 : 0.9;
        if (tagConfidence > typeResult.confidence) {
          typeResult = {
            type: tagTypeHint,
            confidence: tagConfidence,
            source: "pattern",
            matchedPattern: `ks-tag:${parsedTag.systemCode}`,
          };
        }
      }
    }

    const SOLAR_OVERRIDE_RX =
      /\bsolcelle|sol\s*panel|photovoltaic|\bpv[\s-]*anlegg|\binverter\b|\b471\.\d{3}\b/i;
    if (name && SOLAR_OVERRIDE_RX.test(name)) {
      typeResult = {
        type: "PRODUCTION",
        confidence: 1.0,
        source: "pattern",
        matchedPattern: "name:solcelle/inverter/471.NNN",
      };
    }

    const CHILLER_OVERRIDE_RX =
      /\bchiller\b|kj[øo]le\s*maskin\s*[/\-]\s*var?me\s*pumpe|var?me\s*pumpe\s*[/\-]\s*kj[øo]le\s*maskin/i;
    if (name && CHILLER_OVERRIDE_RX.test(name)) {
      typeResult = {
        type: "COOLING",
        confidence: 1.0,
        source: "pattern",
        matchedPattern: "name:chiller/kjølemaskin+varmepumpe",
      };
    }

    if (typeResult.confidence < 0.5) {
      for (const cellVal of allCellValues) {
        if (
          cellVal === rawType ||
          cellVal === name ||
          cellVal === meterLocation
        )
          continue;
        const cellTypeResult = detectMeterType(cellVal);
        if (cellTypeResult.confidence > typeResult.confidence) {
          typeResult = cellTypeResult;
          if (typeResult.confidence >= 0.8) break; // God nok
        }
      }
    }

    if (typeResult.confidence < 0.5) {
      issues.push({
        field: "type",
        severity: "warning",
        message: `Type kunne ikke bestemmes sikkert — satt til ${typeResult.type} (${(typeResult.confidence * 100).toFixed(0)}%)`,
      });
    }

    const customerIntentRaw: CustomerIntentRawFields = {
      roleText: rawRoleIntent,
      otherDescription: rawRoleIntentOther,
      parentName,
      energySourceName: rawEnergySourceName,
      tenantBillable: rawTenantBillable,
      hasData: rawHasData ?? rawImportStatus,
      notes: rawClassificationNotes,
      hierarchyRole: rawHierarchyRole,
    };
    const hasCustomerIntent = Object.values(customerIntentRaw).some(
      (value) => value && value.trim().length > 0,
    );
    const customerIntent = hasCustomerIntent
      ? normalizeCustomerIntent(customerIntentRaw, typeResult.type)
      : null;
    if (customerIntent) {
      for (const warning of customerIntent.warnings) {
        issues.push(warning);
      }
      if (customerIntent.importStatus === "skip") {
        issues.push({
          field: "importStatus",
          severity: "info",
          message:
            customerIntent.importStatusReason ??
            "Raden er markert som ikke importbar i masterlisten.",
        });
      } else if (customerIntent.importStatus === "needs_review") {
        issues.push({
          field: "importStatus",
          severity: "warning",
          message:
            customerIntent.importStatusReason ??
            "Raden må verifiseres før import.",
        });
      }
    }

    let subMeterCategory: SubMeterCategory | null = null;
    let categoryConfidence = 0;

    const categoryContextName = name ?? allCellText.slice(0, 200);
    const categorySuggestion: CategorySuggestion | null = suggestCategory(
      categoryContextName,
      composedLocation,
      typeResult.type,
    );

    if (categorySuggestion) {
      subMeterCategory = categorySuggestion.category;
      categoryConfidence = categorySuggestion.confidence;
    }

    const subCatText = [name, composedLocation, allCellText.slice(0, 300)]
      .filter(Boolean)
      .join(" ");
    const subCatSuggestion = suggestSubCategory(subCatText, subMeterCategory);
    const subMeterSubCategory = subCatSuggestion?.subCategory ?? null;

    if (subCatSuggestion && !subMeterCategory) {
      subMeterCategory = subCatSuggestion.parentCategory;
      categoryConfidence = subCatSuggestion.confidence;
    }

    const subMeterDetection = detectIsSubMeter({
      name,
      parentName,
      isSubMeterField,
      meterLocation: composedLocation,
    });

    if (subMeterDetection.isSubMeter) {
      summary.subMeterCount++;
    }

    const hasErrors = issues.some((i) => i.severity === "error");
    const hasWarnings = issues.some((i) => i.severity === "warning");
    const status = hasErrors ? "error" : hasWarnings ? "warning" : "valid";

    summary.detectedTypes[typeResult.type]++;
    if (subMeterCategory) {
      summary.detectedCategories[subMeterCategory] =
        (summary.detectedCategories[subMeterCategory] ?? 0) + 1;
    }
    if (status === "error") summary.errors++;
    else if (status === "warning") summary.warnings++;
    else summary.valid++;

    rows.push({
      rowIndex: rawRow.rowIndex,
      name,
      mpid,
      type: typeResult.type,
      typeConfidence: typeResult.confidence,
      meterLocation: composedLocation,
      subMeterCategory,
      subMeterSubCategory,
      categoryConfidence,
      isSubMeter: subMeterDetection.isSubMeter,
      parentName,
      subMeterLabel,
      floor,
      block,
      bus,
      externalId,
      tag: tagSource,
      parsedTag,
      groupBlock,
      customerIntentRaw,
      customerIntent,
      status,
      issues,
      rawCells: rawRow.cells,
    });
  }

  return { rows, summary };
}


function meterTypeFromKsCategory(
  cat: KsElementCategory,
): MeteringPointType | null {
  switch (cat) {
    case "EL_HOVEDTAVLE":
    case "EL_FORDELING":
    case "EL_HEATING": // 45x elvarme måler elektrisk forbruk
    case "ELEVATOR": // strøm til heis
      return "ELECTRICITY";
    case "SOLAR_PV":
      return "PRODUCTION";
    case "THERMAL_HEAT_DISTRIBUTION":
      return "HEAT";
    case "THERMAL_COOLING_SYSTEM":
      return "COOLING";
    case "HEAT_PUMP_AND_COOLING":
      return null;
    case "SANITARY":
      return "WATER";
    case "VENTILATION_AGGREGATE":
      return "ELECTRICITY";
    case "UNKNOWN":
    default:
      return null;
  }
}


function composeMeterLocation(
  location: string | null,
  floor: string | null,
  block: string | null,
): string | null {
  const parts: string[] = [];

  if (block) parts.push(block);
  if (location) parts.push(location);
  if (floor) {
    const floorNorm = floor.toLowerCase().replace(/\s+/g, "");
    const locationNorm = (location ?? "").toLowerCase().replace(/\s+/g, "");
    if (!locationNorm.includes(floorNorm)) {
      parts.push(floor);
    }
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

export function updateTransformedRow(
  row: TransformedRow,
  updates: Partial<
    Pick<
      TransformedRow,
      | "name"
      | "mpid"
      | "type"
      | "meterLocation"
      | "subMeterCategory"
      | "isSubMeter"
      | "parentName"
      | "subMeterLabel"
    >
  >,
): TransformedRow {
  const updated = { ...row, ...updates };

  const issues: ImportIssue[] = [];
  if (!updated.name && !updated.mpid) {
    issues.push({
      field: "name/mpid",
      severity: "error",
      message: "Verken navn eller MPID er angitt",
    });
  }

  updated.issues = issues;
  updated.status = issues.some((i) => i.severity === "error")
    ? "error"
    : issues.some((i) => i.severity === "warning")
      ? "warning"
      : "valid";

  return updated;
}
