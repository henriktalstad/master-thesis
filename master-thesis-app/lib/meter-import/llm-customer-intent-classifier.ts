import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { MeterHierarchyRole, MeteringPointType } from "@/generated/client";
import { asSdkLanguageModel } from "@/lib/ai/sdk-language-model";
import {
  CUSTOMER_METER_ROLE_OPTIONS,
  METER_ROLE_INTENT_LABELS,
  validateRoleIntentForMeterType,
  type MeterRoleIntent,
} from "@/lib/energy-flow/meter-role-intent";
import type {
  CustomerImportStatus,
  CustomerIntentWarning,
  CustomerMeterRef,
  NormalizedCustomerIntent,
} from "./customer-intent-normalizer";
import { normalizeCustomerText } from "./customer-intent-normalizer";

const MeterRoleIntentSchema = z.enum([
  "electricity_grid_main",
  "electricity_load_branch",
  "electricity_conversion_input",
  "heat_grid_delivered",
  "heat_production",
  "heat_distribution",
  "cooling_grid_delivered",
  "cooling_production",
  "cooling_distribution",
  "ambient_source",
  "solar_production",
  "grid_export",
  "aggregator",
  "unknown",
] satisfies [MeterRoleIntent, ...MeterRoleIntent[]]);

const MeterTypeSchema = z.enum([
  "ELECTRICITY",
  "HEAT",
  "COOLING",
  "PRODUCTION",
  "WATER",
] satisfies [MeteringPointType, ...MeteringPointType[]]);

const HierarchyHintSchema = z
  .enum(["TOTAL", "BRANCH", "LEAF", "STANDALONE", "unknown"])
  .nullable();

const CustomerIntentRowSchema = z.object({
  tempId: z.string(),
  roleIntent: MeterRoleIntentSchema,
  hierarchyHint: HierarchyHintSchema,
  isTenantBillable: z.boolean().nullable(),
  importStatus: z.enum(["import", "skip", "planned", "needs_review"]),
  parentRef: z.string().nullable(),
  energySourceRef: z.string().nullable(),
  subMeterCategory: z.string().nullable(),
  subMeterSubCategory: z.string().nullable(),
  suggestedMeterType: MeterTypeSchema.nullable(),
  typeCompatibility: z.enum([
    "compatible",
    "corrected_type_suggested",
    "incompatible",
    "unknown",
  ]),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
  reasoning: z.string(),
});

const CustomerIntentBatchSchema = z.object({
  rows: z.array(CustomerIntentRowSchema),
});

export type CustomerIntentLlmInputRow = {
  tempId: string;
  name: string | null;
  mpid: string | null;
  type: MeteringPointType;
  tag: string | null;
  meterLocation: string | null;
  hasData: string | null;
  roleText: string | null;
  otherDescription: string | null;
  parentName: string | null;
  energySourceName: string | null;
  tenantBillable: string | null;
  notes: string | null;
};

export type CustomerIntentLlmCandidate = {
  tempId: string;
  name: string | null;
  mpid: string | null;
  type: MeteringPointType;
  tag: string | null;
  aliases?: string[];
};

export type CustomerIntentLlmBatchInput = {
  rows: CustomerIntentLlmInputRow[];
  candidates: CustomerIntentLlmCandidate[];
};

function makeRef(value: string | null): CustomerMeterRef | null {
  const raw = value?.trim();
  if (!raw) return null;
  return {
    raw,
    normalized: normalizeCustomerText(raw).replace(/\?/g, "").trim(),
    uncertain: raw.includes("?"),
  };
}

function warningList(
  messages: string[],
  field = "customerIntent",
): CustomerIntentWarning[] {
  return messages.map((message) => ({
    field,
    severity: "warning",
    message,
  }));
}

export async function classifyCustomerIntentBatchWithLLM(
  input: CustomerIntentLlmBatchInput,
): Promise<Map<string, Partial<NormalizedCustomerIntent>>> {
  if (input.rows.length === 0) return new Map();

  const roleOptions = CUSTOMER_METER_ROLE_OPTIONS.map((label) => {
    const intent = Object.entries(METER_ROLE_INTENT_LABELS).find(
      ([, value]) => value === label,
    )?.[0];
    return `- ${label}${intent ? ` -> ${intent}` : ""}`;
  }).join("\n");

  try {
    const result = await generateObject({
      model: asSdkLanguageModel(openai("gpt-4.1-mini")),
      schema: CustomerIntentBatchSchema,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `Du tolker norske måler-masterlister for næringsbygg.

Returner KUN verdier som passer schemaet.
Du skal oversette kundens tekst til appens strukturerte valg, ikke finne opp nye enum-verdier.
Parent/source skal kun være tekstlig referanse til en faktisk kandidat i listen, eller null.
Hvis noe er usikkert: sett lavere confidence, legg warning, og bruk needs_review.

Gyldige dropdown-valg for "Hva måler denne?":
${roleOptions}

Viktige regler:
- Strømmåler som driver varmepumpe/kjølemaskin/el-kjel er electricity_conversion_input.
- Produsert varme/kjøling er termisk output, ikke strømforbruk.
- Kildeenergi fra brønnpark/sjø/luft/frikjøling er ambient_source og normalt ikke fakturerbar.
- Branch/mellommåler avledes vanligvis av at andre målere peker på den som overordnet.
- BRANCH, TOTAL, CONVERSION_INPUT, PRODUCTION_GROSS, AMBIENT_SOURCE og GRID_EXPORTED skal normalt ikke faktureres direkte til leietaker.
- Hvis målertype og rolle kolliderer, foreslå suggestedMeterType eller sett needs_review.`,
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    });

    const map = new Map<string, Partial<NormalizedCustomerIntent>>();
    for (const row of result.object.rows) {
      const original = input.rows.find(
        (candidate) => candidate.tempId === row.tempId,
      );
      if (!original) continue;
      const typeValidation = validateRoleIntentForMeterType(
        row.roleIntent,
        original.type,
      );
      const hierarchyHint =
        row.hierarchyHint && row.hierarchyHint !== "unknown"
          ? (row.hierarchyHint as MeterHierarchyRole)
          : null;
      const confidence = Math.max(0, Math.min(row.confidence, 0.95));
      map.set(row.tempId, {
        source: "ai",
        importStatus: row.importStatus as CustomerImportStatus,
        isTenantBillable: row.isTenantBillable,
        tenantBillableConfidence:
          row.isTenantBillable === null ? 0 : confidence,
        roleIntent: row.roleIntent,
        roleIntentConfidence: confidence,
        roleIntentReason: row.reasoning,
        expectedMeterTypes: typeValidation.expectedTypes,
        typeCompatibility:
          row.typeCompatibility === "unknown"
            ? typeValidation.compatibility
            : row.typeCompatibility,
        suggestedMeterType:
          row.suggestedMeterType ?? typeValidation.suggestedMeterType,
        hierarchyHint,
        explicitParentRef: makeRef(row.parentRef),
        explicitEnergySourceRef: makeRef(row.energySourceRef),
        subMeterCategory: null,
        subMeterSubCategory: null,
        warnings: warningList(row.warnings),
      });
    }
    return map;
  } catch (err) {
    console.error(
      "[meter-import] LLM klassifisering av kundeintent feilet:",
      err,
    );
    return new Map();
  }
}
