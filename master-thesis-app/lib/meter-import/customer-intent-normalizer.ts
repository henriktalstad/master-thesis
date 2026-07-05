import type {
  MeterHierarchyRole,
  MeteringPointType,
  SubMeterCategory,
  SubMeterSubCategory,
} from "@/generated/client";
import {
  METER_ROLE_INTENT_LABELS,
  roleIntentFromCustomerLabel,
  validateRoleIntentForMeterType,
  type MeterRoleIntent,
  type MeterRoleTypeCompatibility,
} from "@/lib/energy-flow/meter-role-intent";

export type CustomerIntentSource = "deterministic" | "ai" | "fallback" | "user";

export type CustomerImportStatus =
  | "import"
  | "skip"
  | "planned"
  | "needs_review";

export type CustomerIntentWarning = {
  field: string;
  severity: "error" | "warning" | "info";
  message: string;
};

export type CustomerMeterRef = {
  raw: string;
  normalized: string;
  uncertain: boolean;
};

export type NormalizedCustomerIntent = {
  source: CustomerIntentSource;
  rawRoleText: string | null;
  rawOtherDescription: string | null;
  importStatus: CustomerImportStatus;
  importStatusReason: string | null;
  isTenantBillable: boolean | null;
  tenantBillableConfidence: number;
  roleIntent: MeterRoleIntent | null;
  roleIntentConfidence: number;
  roleIntentReason: string | null;
  expectedMeterTypes: MeteringPointType[];
  typeCompatibility: MeterRoleTypeCompatibility;
  suggestedMeterType: MeteringPointType | null;
  hierarchyHint: MeterHierarchyRole | null;
  explicitParentRef: CustomerMeterRef | null;
  explicitEnergySourceRef: CustomerMeterRef | null;
  subMeterCategory: SubMeterCategory | null;
  subMeterSubCategory: SubMeterSubCategory | null;
  warnings: CustomerIntentWarning[];
};

export type CustomerIntentRawFields = {
  roleText?: string | null;
  otherDescription?: string | null;
  parentName?: string | null;
  energySourceName?: string | null;
  tenantBillable?: string | null;
  hasData?: string | null;
  notes?: string | null;
  hierarchyRole?: string | null;
};

const UNCERTAIN_RX = /\?|usikker|mulig|kanskje|tror|avklar/i;
const NOT_MOUNTED_RX = /ikke\s*montert|ikke\s*installert|planlagt|mangler/i;
const BROKEN_RX = /fungerer\s*ikke|defekt|feil|ute\s*av\s*drift/i;
const ZERO_USAGE_RX = /(?:tilnærmet\s*)?0\s*forbruk|null\s*forbruk/i;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeCustomerText(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "a")
    .replace(/[^\p{Letter}\p{Number}?%]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hasUncertainty(value: string | null | undefined): boolean {
  return UNCERTAIN_RX.test(value ?? "");
}

function makeRef(value: string | null | undefined): CustomerMeterRef | null {
  const raw = clean(value);
  if (!raw) return null;
  return {
    raw,
    normalized: normalizeCustomerText(raw).replace(/\?/g, "").trim(),
    uncertain: hasUncertainty(raw),
  };
}

function parseBoolean(value: string | null | undefined): {
  value: boolean | null;
  confidence: number;
  warning: CustomerIntentWarning | null;
} {
  const raw = clean(value);
  if (!raw) return { value: null, confidence: 0, warning: null };
  const normalized = normalizeCustomerText(raw);
  if (/^(ja|j|yes|true|1)$/.test(normalized)) {
    return { value: true, confidence: 1, warning: null };
  }
  if (/^(nei|n|no|false|0)$/.test(normalized)) {
    return { value: false, confidence: 1, warning: null };
  }
  if (/ikke\s*fakturerbar|skal\s*ikke\s*faktureres/.test(normalized)) {
    return { value: false, confidence: 0.9, warning: null };
  }
  if (/fakturerbar|skal\s*faktureres/.test(normalized)) {
    return { value: true, confidence: 0.8, warning: null };
  }
  return {
    value: null,
    confidence: 0.2,
    warning: {
      field: "tenantBillable",
      severity: "warning",
      message: `Fakturerbar-verdi "${raw}" kunne ikke tolkes sikkert.`,
    },
  };
}

function parseHierarchyRole(value: string | null | undefined): {
  value: MeterHierarchyRole | null;
  warning: CustomerIntentWarning | null;
} {
  const raw = clean(value);
  if (!raw) return { value: null, warning: null };
  const normalized = normalizeCustomerText(raw);
  if (/^(total|topp|hoved|hovedmaler|top)$/i.test(normalized)) {
    return { value: "TOTAL", warning: null };
  }
  if (/^(branch|mellommaler|mellom|fordeler|underfordeling)$/i.test(normalized)) {
    return { value: "BRANCH", warning: null };
  }
  if (/^(leaf|ende|endemaler|slutt|sluttmaler)$/i.test(normalized)) {
    return { value: "LEAF", warning: null };
  }
  if (/^(standalone|frittstaende|frittstaaende|egen)$/i.test(normalized)) {
    return { value: "STANDALONE", warning: null };
  }
  return {
    value: null,
    warning: {
      field: "hierarchyRole",
      severity: "warning",
      message: `Hierarkirolle "${raw}" kunne ikke tolkes sikkert.`,
    },
  };
}

function parseRoleIntent(
  rawRoleText: string | null,
  otherDescription: string | null,
): {
  roleIntent: MeterRoleIntent | null;
  confidence: number;
  reason: string | null;
  hierarchyHint: MeterHierarchyRole | null;
} {
  const dropdownIntent = roleIntentFromCustomerLabel(rawRoleText);
  if (dropdownIntent && dropdownIntent !== "unknown") {
    return {
      roleIntent: dropdownIntent,
      confidence: 1,
      reason: "Eksakt dropdown-valg fra masterliste.",
      hierarchyHint: null,
    };
  }
  if (dropdownIntent === "unknown" && !clean(otherDescription)) {
    return {
      roleIntent: "unknown",
      confidence: 0.2,
      reason: "Kunden valgte Annet / beskriv selv.",
      hierarchyHint: null,
    };
  }

  const text = normalizeCustomerText(
    [rawRoleText, otherDescription].filter(Boolean).join(" "),
  );
  if (!text) {
    return {
      roleIntent: null,
      confidence: 0,
      reason: null,
      hierarchyHint: null,
    };
  }

  const hierarchyHint: MeterHierarchyRole | null =
    /mellommaler|branch|fordeler\s*videre|under\s*seg/.test(text)
      ? "BRANCH"
      : null;

  // Reglene tolkes sekvensielt — mer spesifikke produksjons/kildemålere
  // må komme FØR generiske el-konverteringsregler (som tidligere fanget
  // f.eks. "produsert varme fra varmepumpe" på "varmepumpe").
  const rules: Array<[RegExp, MeterRoleIntent, string]> = [
    [
      /\bsolcelle|\bpv\b|inverter|\b471\b/,
      "solar_production",
      "Solcelle/lokal strømproduksjon.",
    ],
    [
      /produsert\s*varme|varme\s*produsert|avgitt\s*varme|varm\s*side/,
      "heat_production",
      "Produsert varme fra lokal kilde.",
    ],
    [
      /produsert\s*kjoling|kjoleproduksjon|chiller\s*output/,
      "cooling_production",
      "Produsert kjøling fra lokal kilde.",
    ],
    [
      /varme\s*levert\s*inn|fjernvarme|ekstern\s*varme/,
      "heat_grid_delivered",
      "Varme levert fra ekstern leverandør.",
    ],
    [
      /kjoling\s*levert\s*inn|fjernkjoling|ekstern\s*kjol/,
      "cooling_grid_delivered",
      "Kjøling levert fra ekstern leverandør.",
    ],
    [
      /bronnpark|frikjoling|kildeenergi|\bgeo(?:\b|sonde|termisk)|borehull|\bsjo\b|uteluft|ambient/,
      "ambient_source",
      "Kildeenergi/ambient source.",
    ],
    [
      /levert\s*varme|gulvvarme|snosmelt|tappevann|ventilasjon|varmebatteri/,
      "heat_distribution",
      "Levert varme til sone eller anlegg.",
    ],
    [
      /levert\s*kjoling|prosesskjoling|datarom|kjolebatteri|ventilasjonsaggregat/,
      "cooling_distribution",
      "Levert kjøling til sone eller anlegg.",
    ],
    [
      /tilfort\s*elektrisk|elektrisk\s*energi|el\s*kjel|torrkjoler|omformer|til\s*varmepumpe|til\s*kjolemaskin/,
      "electricity_conversion_input",
      "Elektrisk energi til konverteringsutstyr.",
    ],
    [
      /strom\s*inn|hovedfordeling|hele\s*bygget|hovedmaler/,
      "electricity_grid_main",
      "Strøm inn/hovedmåler.",
    ],
    [
      /strom\s*til|underfordeling|kurs|vifte|heis|automatikkskap|teknisk\s*anlegg/,
      "electricity_load_branch",
      "Strøm til last eller underfordeling.",
    ],
  ];

  for (const [rx, intent, reason] of rules) {
    if (rx.test(text)) {
      return {
        roleIntent: intent,
        confidence:
          hasUncertainty(rawRoleText) || hasUncertainty(otherDescription)
            ? 0.65
            : 0.75,
        reason,
        hierarchyHint,
      };
    }
  }

  return {
    roleIntent: "unknown",
    confidence: 0.2,
    reason: "Fritekst kunne ikke mappes deterministisk.",
    hierarchyHint,
  };
}

export function normalizeCustomerIntent(
  fields: CustomerIntentRawFields,
  meterType: MeteringPointType,
): NormalizedCustomerIntent {
  const warnings: CustomerIntentWarning[] = [];
  const rawRoleText = clean(fields.roleText);
  const rawOtherDescription = clean(fields.otherDescription);
  const notes = clean(fields.notes);
  const hasData = clean(fields.hasData);

  const billable = parseBoolean(fields.tenantBillable);
  if (billable.warning) warnings.push(billable.warning);
  const explicitHierarchy = parseHierarchyRole(fields.hierarchyRole);
  if (explicitHierarchy.warning) warnings.push(explicitHierarchy.warning);

  let importStatus: CustomerImportStatus = "import";
  let importStatusReason: string | null = null;
  const statusText = [hasData, notes].filter(Boolean).join(" ");
  if (NOT_MOUNTED_RX.test(statusText)) {
    importStatus = /planlagt/i.test(statusText) ? "planned" : "skip";
    importStatusReason =
      "Raden ser ut til å gjelde en planlagt eller ikke montert måler.";
  } else if (BROKEN_RX.test(statusText)) {
    importStatus = "needs_review";
    importStatusReason = "Merknad indikerer at måleren ikke fungerer.";
  } else if (/^nei$/i.test(hasData ?? "")) {
    importStatus = "needs_review";
    importStatusReason = "Måleren er markert med Har data = Nei.";
  }

  if (notes && ZERO_USAGE_RX.test(notes)) {
    warnings.push({
      field: "notes",
      severity: "info",
      message: "Merknad indikerer null eller tilnærmet null forbruk.",
    });
  }

  const role = parseRoleIntent(rawRoleText, rawOtherDescription);
  const typeValidation = validateRoleIntentForMeterType(
    role.roleIntent,
    meterType,
  );
  if (typeValidation.warning) {
    warnings.push({
      field: "type",
      severity:
        typeValidation.compatibility === "incompatible" ? "warning" : "info",
      message: typeValidation.warning,
    });
  }

  const parentRef = makeRef(fields.parentName);
  const energySourceRef = makeRef(fields.energySourceName);
  if (parentRef?.uncertain) {
    warnings.push({
      field: "parentName",
      severity: "warning",
      message: `Overordnet måler "${parentRef.raw}" er markert som usikker.`,
    });
  }
  if (energySourceRef?.uncertain) {
    warnings.push({
      field: "energySourceName",
      severity: "warning",
      message: `Energikilde "${energySourceRef.raw}" er markert som usikker.`,
    });
  }

  if (role.roleIntent === "unknown" && rawOtherDescription) {
    importStatus = importStatus === "skip" ? importStatus : "needs_review";
    warnings.push({
      field: "roleIntent",
      severity: "warning",
      message:
        "Rollen er satt til Annet / beskriv selv og må tolkes av AI eller verifiseres manuelt.",
    });
  }

  return {
    source: "deterministic",
    rawRoleText,
    rawOtherDescription,
    importStatus,
    importStatusReason,
    isTenantBillable: billable.value,
    tenantBillableConfidence: billable.confidence,
    roleIntent: role.roleIntent,
    roleIntentConfidence: role.confidence,
    roleIntentReason: role.reason,
    expectedMeterTypes: typeValidation.expectedTypes,
    typeCompatibility: typeValidation.compatibility,
    suggestedMeterType: typeValidation.suggestedMeterType,
    hierarchyHint: explicitHierarchy.value ?? role.hierarchyHint,
    explicitParentRef: parentRef,
    explicitEnergySourceRef: energySourceRef,
    subMeterCategory: null,
    subMeterSubCategory: null,
    warnings,
  };
}

export function mergeCustomerIntentWithAi(
  deterministic: NormalizedCustomerIntent,
  ai: Partial<NormalizedCustomerIntent> | null | undefined,
): NormalizedCustomerIntent {
  if (!ai) return deterministic;
  const aiWarnings = ai.warnings ?? [];
  return {
    ...deterministic,
    ...ai,
    source: "ai",
    warnings: [...deterministic.warnings, ...aiWarnings],
    rawRoleText: deterministic.rawRoleText,
    rawOtherDescription: deterministic.rawOtherDescription,
  };
}

export function roleIntentLabel(
  intent: MeterRoleIntent | null | undefined,
): string {
  return intent ? METER_ROLE_INTENT_LABELS[intent] : "Ikke tolket";
}
