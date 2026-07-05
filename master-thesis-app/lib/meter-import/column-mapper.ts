import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { asSdkLanguageModel } from "@/lib/ai/sdk-language-model";
import { z } from "zod";
import { normalizeHeader, type RawImportRow } from "./parser";


export type MappableField =
  | "name"
  | "mpid"
  | "type"
  | "meterLocation"
  | "parentName"
  | "floor"
  | "block"
  | "bus"
  | "externalId"
  | "subMeterLabel"
  | "isSubMeter"
  | "tag"
  | "groupBlock"
  | "hasData"
  | "tenantBillable"
  | "roleIntent"
  | "roleIntentOther"
  | "energySourceName"
  | "hierarchyRole"
  | "classificationNotes"
  | "importStatus"
  | "skip";

export interface ColumnMapping {
  header: string;
  normalizedHeader: string;
  field: MappableField;
  confidence: number;
  source: "deterministic" | "ai" | "user";
  sampleValues: string[];
}

export interface ColumnMappingResult {
  mappings: ColumnMapping[];
  unmappedHeaders: string[];
  usedAiFallback: boolean;
}


export const MAPPABLE_FIELD_META: Record<
  MappableField,
  { label: string; description: string; required: boolean }
> = {
  name: {
    label: "Målernavn",
    description: "Navn / beskrivelse på måleren",
    required: false,
  },
  mpid: {
    label: "Målepunkt-ID",
    description: "Unik ID (MPID) for målepunktet",
    required: false,
  },
  type: {
    label: "Energitype",
    description: "Strøm, Varme, Kjøling, Produksjon",
    required: false,
  },
  meterLocation: {
    label: "Plassering",
    description: "Fysisk plassering (tavle, sentral)",
    required: false,
  },
  parentName: {
    label: "Overordnet",
    description: "Overordnet måler (for undermålere)",
    required: false,
  },
  floor: {
    label: "Etasje",
    description: "Plan / etasje i bygget",
    required: false,
  },
  block: {
    label: "Blokk",
    description: "Blokk / bygningsdel",
    required: false,
  },
  bus: {
    label: "Bus / Protokoll",
    description: "Bus-adresse, Modbus, M-Bus etc.",
    required: false,
  },
  externalId: {
    label: "Ekstern ID",
    description: "Tag / ID fra eksternt system",
    required: false,
  },
  subMeterLabel: {
    label: "Beskrivelse / egendefinert kategori",
    description: "Beskrivelse eller tekst for kategorien «Annet»",
    required: false,
  },
  isSubMeter: {
    label: "Er undermåler",
    description: "Ja/nei - er dette en undermåler",
    required: false,
  },
  tag: {
    label: "Tag (KS/TFM)",
    description: "KS-/TFM-tag som +TRAV2=432.101-OE008",
    required: false,
  },
  groupBlock: {
    label: "Gruppe / blokk-rad",
    description: "Gruppe-overskrift som fyller ned",
    required: false,
  },
  hasData: {
    label: "Har data",
    description: "Om måleren faktisk leverer data (Ja/Nei)",
    required: false,
  },
  tenantBillable: {
    label: "Fakturerbar",
    description: "Om måleren skal kunne brukes i leietakerfordeling",
    required: false,
  },
  roleIntent: {
    label: "Hva måler denne?",
    description: "Kundens strukturerte valg for hva måleren representerer",
    required: false,
  },
  roleIntentOther: {
    label: "Beskrivelse hvis annet",
    description: "Fritekst når kunden har valgt Annet / beskriv selv",
    required: false,
  },
  energySourceName: {
    label: "Energikilde",
    description: "Måler/kilde denne energien kommer fra",
    required: false,
  },
  hierarchyRole: {
    label: "Hierarkirolle",
    description: "Toppmåler, mellommåler, endemåler eller frittstående",
    required: false,
  },
  classificationNotes: {
    label: "Merknad",
    description: "Kommentar eller merknad som bør vises i import-preview",
    required: false,
  },
  importStatus: {
    label: "Importstatus",
    description: "Importeres, planlagt eller ikke montert",
    required: false,
  },
  skip: {
    label: "Hopp over",
    description: "Ignorer denne kolonnen",
    required: false,
  },
};


interface MappingRule {
  exact?: string[];
  pattern?: RegExp;
  field: MappableField;
  confidence: number;
}

const MAPPING_RULES: MappingRule[] = [
  {
    exact: [
      "har data",
      "hardata",
      "data",
      "måler har data",
      "maler har data",
      "has data",
      "hasdata",
    ],
    field: "hasData",
    confidence: 1.0,
  },
  {
    exact: [
      "hva måler denne?",
      "hva maler denne?",
      "hva måler denne",
      "hva maler denne",
      "hva måler måleren",
      "hva maler maleren",
      "målerrolle",
      "malerrolle",
      "rolle",
      "role intent",
      "roleintent",
      "meter role",
    ],
    field: "roleIntent",
    confidence: 1.0,
  },
  {
    pattern: /^(hva\s+m[åa]ler|m[åa]ler\s*rolle|role\s*intent|meter\s*role)/,
    field: "roleIntent",
    confidence: 0.95,
  },
  {
    exact: [
      "beskrivelse hvis annet",
      "beskrivelse ved annet",
      "annet beskrivelse",
      "annet - beskrivelse",
      "annet/beskriv selv",
      "beskriv selv",
      "other description",
      "role other",
    ],
    field: "roleIntentOther",
    confidence: 1.0,
  },
  {
    pattern: /(beskrivelse|beskriv).*(annet|selv)|annet.*beskrivelse/,
    field: "roleIntentOther",
    confidence: 0.9,
  },
  {
    exact: [
      "fakturerbar",
      "faktureres",
      "skal faktureres",
      "leietakerfakturerbar",
      "tenant billable",
      "tenantbillable",
      "billable",
    ],
    field: "tenantBillable",
    confidence: 1.0,
  },
  {
    pattern: /(fakturer|billable)/,
    field: "tenantBillable",
    confidence: 0.9,
  },
  {
    exact: [
      "energikilde",
      "energi kilde",
      "energikilde måler",
      "energikilde maler",
      "kilde",
      "source",
      "energy source",
      "energysource",
      "source meter",
    ],
    field: "energySourceName",
    confidence: 1.0,
  },
  {
    pattern: /^(energi\s*)?kilde$|^energy\s*source$|^source\s*meter$/,
    field: "energySourceName",
    confidence: 0.95,
  },
  {
    exact: [
      "hierarkirolle",
      "hierarki rolle",
      "hierarchy role",
      "hierarchyrole",
      "mellommåler",
      "mellommaler",
      "toppmåler",
      "toppmaler",
      "endemåler",
      "endemaler",
    ],
    field: "hierarchyRole",
    confidence: 1.0,
  },
  {
    exact: [
      "importeres",
      "importstatus",
      "import status",
      "status import",
      "ikke montert",
      "planlagt",
    ],
    field: "importStatus",
    confidence: 1.0,
  },
  {
    exact: [
      "merknad",
      "merknader",
      "klassifiseringsmerknad",
      "kommentar til klassifisering",
      "classification notes",
      "classification note",
    ],
    field: "classificationNotes",
    confidence: 1.0,
  },

  {
    exact: [
      "tag",
      "ks-tag",
      "kstag",
      "ks tag",
      "tfm-tag",
      "tfm tag",
      "tfmtag",
      "anleggs-tag",
      "anleggstag",
      "system-tag",
      "systemtag",
      "kontrollstrekk",
      "ns 3451",
      "ns3451",
    ],
    field: "tag",
    confidence: 1.0,
  },
  {
    pattern: /^(ks|tfm|anlegg|system)[\s_-]?(tag|kode)$/,
    field: "tag",
    confidence: 0.9,
  },

  {
    exact: [
      "navn",
      "name",
      "målernavn",
      "malernavn",
      "meter name",
      "metername",
      "beskrivelse",
      "description",
      "betegnelse",
      "komponent",
      "enhet",
      "navn måler i energinett",
      "navn maler i energinett",
      "navn i energinett",
      "meter label",
    ],
    field: "name",
    confidence: 1.0,
  },
  {
    pattern: /^(m[åa]ler)?[\s_-]?navn/,
    field: "name",
    confidence: 0.9,
  },
  {
    pattern: /navn[\s_-]?(m[åa]ler|i energi)/,
    field: "name",
    confidence: 0.9,
  },

  {
    exact: [
      "mpid",
      "mp-id",
      "meter id",
      "meterid",
      "målepunkt-id",
      "malepunkt-id",
      "målepunktid",
      "malepunktid",
      "meter point id",
      "anlegg-id",
      "anleggsid",
      "anlaeggs-id",
      "anleggsnr",
      "elhub-id",
      "elhub id",
      "måler id",
      "maler id",
      "målerid",
      "malerid",
    ],
    field: "mpid",
    confidence: 1.0,
  },
  {
    pattern: /^(m[åa]le?punkt|meter|mp|anlegg|m[åa]ler)[\s_-]?(id|nr|nummer)/,
    field: "mpid",
    confidence: 0.9,
  },

  {
    exact: [
      "type",
      "energitype",
      "målertype",
      "malertype",
      "meter type",
      "metertype",
      "energy type",
      "energytype",
      "medium",
      "carrier",
      "energibærer",
      "energibaerer",
      "måler",
      "maler",
    ],
    field: "type",
    confidence: 1.0,
  },
  {
    pattern: /^(energi|m[åa]ler|meter)[\s_-]?type/,
    field: "type",
    confidence: 0.9,
  },

  {
    exact: [
      "plassering",
      "lokasjon",
      "location",
      "placement",
      "sted",
      "plassering energimåler",
      "plassering energimaler",
      "fysisk plassering",
      "tavle",
      "sentral",
      "rom",
      "montert",
      "installert",
      "where",
      "position",
    ],
    field: "meterLocation",
    confidence: 1.0,
  },
  {
    pattern: /^(plassering|lokasjon|location|montert|installert|fysisk)/,
    field: "meterLocation",
    confidence: 0.9,
  },
  {
    pattern: /(plassering|lokasjon)$/,
    field: "meterLocation",
    confidence: 0.8,
  },

  {
    exact: [
      "overordnet",
      "parent",
      "hovemåler",
      "hovedmaler",
      "main meter",
      "overordnet måler",
      "overordnet maler",
      "parent meter",
      "tilhører",
      "tilhorer",
      "under",
    ],
    field: "parentName",
    confidence: 1.0,
  },
  {
    pattern: /^(overordnet|parent|hoved[\s_-]?m[åa]l)/,
    field: "parentName",
    confidence: 0.9,
  },

  {
    exact: [
      "etasje",
      "plan",
      "floor",
      "level",
      "etg",
      "etg.",
      "storey",
      "bygningsnivå",
      "bygningsniva",
    ],
    field: "floor",
    confidence: 1.0,
  },
  {
    pattern: /^(etasje|plan|floor|level|etg)/,
    field: "floor",
    confidence: 0.9,
  },

  {
    exact: [
      "blokk",
      "block",
      "bygg",
      "bygning",
      "building",
      "seksjon",
      "del",
      "wing",
      "fløy",
      "floy",
    ],
    field: "block",
    confidence: 1.0,
  },
  {
    pattern: /^(blokk|block|bygg|seksjon|del|fl[øo]y)/,
    field: "block",
    confidence: 0.9,
  },

  {
    exact: [
      "gruppe",
      "gruppering",
      "group",
      "gruppe-blokk",
      "kategori",
      "category",
      "section",
      "tavle/sentral",
      "tavle / sentral",
      "tavle gruppe",
    ],
    field: "groupBlock",
    confidence: 1.0,
  },
  {
    pattern: /^(gruppe|gruppering|kategori|section)$/,
    field: "groupBlock",
    confidence: 0.9,
  },

  {
    exact: [
      "bus",
      "buss",
      "protocol",
      "protokoll",
      "kommunikasjon",
      "modbus",
      "m-bus",
      "mbus",
      "bacnet",
      "lon",
      "bus-adresse",
      "busadresse",
      "bus address",
    ],
    field: "bus",
    confidence: 1.0,
  },
  {
    pattern: /^(bus|buss|modbus|m-bus|protocol|kommunikasjon)/,
    field: "bus",
    confidence: 0.9,
  },

  {
    exact: [
      "tag",
      "ekstern id",
      "external id",
      "eksternid",
      "externalid",
      "sender",
      "system",
      "kilde-id",
      "source id",
      "referanse",
      "reference",
      "ref",
    ],
    field: "externalId",
    confidence: 1.0,
  },
  {
    pattern: /^(tag|ekstern|external|sender|kilde)[\s_-]?(id|ref)?/,
    field: "externalId",
    confidence: 0.8,
  },

  {
    exact: [
      "undermåler",
      "undermaler",
      "sub meter",
      "submeter",
      "undermåler-etikett",
      "undermaler-etikett",
      "sub label",
    ],
    field: "subMeterLabel",
    confidence: 1.0,
  },

  {
    exact: [
      "er undermåler",
      "er undermaler",
      "is sub meter",
      "issubmeter",
      "undermåler ja/nei",
      "sub meter yes/no",
      "under",
    ],
    field: "isSubMeter",
    confidence: 1.0,
  },

  {
    exact: [
      "ip",
      "ip-adresse",
      "ip adresse",
      "ip address",
      "gsm",
      "gsm nr",
      "gsm nr.",
      "api",
      "mqtt",
      "kolonne2",
      "info",
      "notat",
      "notater",
      "kommentar",
      "kommentarer",
      "comment",
      "comments",
      "mottaker",
      "eos",
      "sender data til",
      "datalogger",
      "plassering datalogger",
    ],
    field: "skip",
    confidence: 1.0,
  },
  {
    pattern:
      /^(ip|gsm|mqtt|api|plassering\s+datalogger|sender\s+data|mottaker)/,
    field: "skip",
    confidence: 0.9,
  },
];


function matchDeterministic(
  normalizedHeader: string,
): { field: MappableField; confidence: number } | null {
  for (const rule of MAPPING_RULES) {
    if (rule.exact?.includes(normalizedHeader)) {
      return { field: rule.field, confidence: rule.confidence };
    }
    if (rule.pattern?.test(normalizedHeader)) {
      return { field: rule.field, confidence: rule.confidence };
    }
  }
  return null;
}


async function mapColumnsWithAI(
  unmappedColumns: {
    header: string;
    normalizedHeader: string;
    sampleValues: string[];
  }[],
): Promise<Map<string, { field: MappableField; confidence: number }>> {
  if (unmappedColumns.length === 0) return new Map();

  const fieldDescriptions = Object.entries(MAPPABLE_FIELD_META)
    .filter(([key]) => key !== "skip")
    .map(([key, meta]) => `- "${key}": ${meta.label} — ${meta.description}`)
    .join("\n");

  const columnsDescription = unmappedColumns
    .map((col) => {
      const samples = col.sampleValues.slice(0, 5).join(", ");
      return `Kolonne "${col.header}" (eksempler: ${samples || "ingen verdier"})`;
    })
    .join("\n");

  try {
    const result = await generateObject({
      model: asSdkLanguageModel(openai("gpt-4.1-mini")),
      schema: z.object({
        mappings: z.array(
          z.object({
            header: z.string().describe("Original kolonne-header"),
            field: z
              .enum([
                "name",
                "mpid",
                "type",
                "meterLocation",
                "parentName",
                "floor",
                "block",
                "bus",
                "externalId",
                "subMeterLabel",
                "isSubMeter",
                "tag",
                "groupBlock",
      "hasData",
      "tenantBillable",
      "roleIntent",
      "roleIntentOther",
      "energySourceName",
      "hierarchyRole",
      "classificationNotes",
      "importStatus",
                "skip",
              ])
              .describe("Hvilket MeteringPoint-felt denne kolonnen mapper til"),
            confidence: z
              .number()
              .min(0)
              .max(1)
              .describe("Hvor sikker er du (0-1)"),
            reasoning: z.string().describe("Kort begrunnelse på norsk"),
          }),
        ),
      }),
      prompt: `Du er en ekspert på norsk bygningsdrift og energimåling.

Oppgave: Mapper kolonner fra en Excel/CSV-fil med målepunktdata til riktige databasefelter.

Tilgjengelige felter:
${fieldDescriptions}
- "skip": Kolonnen er irrelevant for målepunktdata (f.eks. rad-nummer, intern merknad)

Kolonner å mappe:
${columnsDescription}

Regler:
- Velg "skip" hvis kolonnen tydelig ikke handler om målepunkter
- Sett confidence lavt (0.3-0.5) hvis du er usikker
- Sett confidence høyt (0.7-0.9) hvis konteksten er tydelig
- Bruk norsk begrunnelse
- "plassering energimåler" = meterLocation
- "Tag" som inneholder format som "+TRAV2=432.101-OE008" eller "432.101" = tag (NB: foretrekkes over externalId)
- "sender" eller annen ID-streng uten KS-/TFM-format = externalId
- Tall-IDer med mange siffer = mpid
- Korte koder (E0130) = externalId
- Kolonner som "Gruppe", "Kategori", "Section" der verdien står på første rad i en gruppe og er tom på påfølgende rader = groupBlock
`,
    });

    const aiMap = new Map<
      string,
      { field: MappableField; confidence: number }
    >();
    for (const mapping of result.object.mappings) {
      const normalizedKey = normalizeHeader(mapping.header);
      aiMap.set(normalizedKey, {
        field: mapping.field as MappableField,
        confidence: Math.min(mapping.confidence, 0.8), // AI aldri over 0.8
      });
    }

    return aiMap;
  } catch (err) {
    console.error("[meter-import] AI kolonne-mapping feilet:", err);
    return new Map();
  }
}


export async function autoMapColumns(
  headers: string[],
  normalizedHeaders: string[],
  sampleRows: RawImportRow[],
  useAiFallback: boolean = true,
): Promise<ColumnMappingResult> {
  const mappings: ColumnMapping[] = [];
  const unmappedForAI: {
    header: string;
    normalizedHeader: string;
    sampleValues: string[];
  }[] = [];

  const usedFields = new Set<MappableField>();

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const normalized = normalizedHeaders[i];
    if (!normalized) continue;

    const sampleValues = sampleRows
      .map((row) => row.cells[normalized])
      .filter((v): v is string => !!v && v.length > 0)
      .slice(0, 5);

    const match = matchDeterministic(normalized);

    if (match && !usedFields.has(match.field)) {
      usedFields.add(match.field);
      mappings.push({
        header,
        normalizedHeader: normalized,
        field: match.field,
        confidence: match.confidence,
        source: "deterministic",
        sampleValues,
      });
    } else {
      unmappedForAI.push({
        header,
        normalizedHeader: normalized,
        sampleValues,
      });
    }
  }

  let usedAi = false;
  if (useAiFallback && unmappedForAI.length > 0) {
    const aiMappings = await mapColumnsWithAI(unmappedForAI);

    if (aiMappings.size > 0) {
      usedAi = true;
      for (const col of unmappedForAI) {
        const aiResult = aiMappings.get(col.normalizedHeader);
        if (aiResult && !usedFields.has(aiResult.field)) {
          usedFields.add(aiResult.field);
          mappings.push({
            header: col.header,
            normalizedHeader: col.normalizedHeader,
            field: aiResult.field,
            confidence: aiResult.confidence,
            source: "ai",
            sampleValues: col.sampleValues,
          });
        } else {
          mappings.push({
            header: col.header,
            normalizedHeader: col.normalizedHeader,
            field: "skip",
            confidence: aiResult?.confidence ?? 0.5,
            source: aiResult ? "ai" : "deterministic",
            sampleValues: col.sampleValues,
          });
        }
      }
    } else {
      for (const col of unmappedForAI) {
        mappings.push({
          header: col.header,
          normalizedHeader: col.normalizedHeader,
          field: "skip",
          confidence: 0.0,
          source: "deterministic",
          sampleValues: col.sampleValues,
        });
      }
    }
  } else {
    for (const col of unmappedForAI) {
      mappings.push({
        header: col.header,
        normalizedHeader: col.normalizedHeader,
        field: "skip",
        confidence: 0.0,
        source: "deterministic",
        sampleValues: col.sampleValues,
      });
    }
  }

  return {
    mappings,
    unmappedHeaders: unmappedForAI.map((c) => c.header),
    usedAiFallback: usedAi,
  };
}

export function applyUserMapping(
  mappings: ColumnMapping[],
  normalizedHeader: string,
  newField: MappableField,
): ColumnMapping[] {
  return mappings.map((m) => {
    if (m.normalizedHeader === normalizedHeader) {
      return {
        ...m,
        field: newField,
        confidence: 1.0,
        source: "user" as const,
      };
    }
    if (
      m.field === newField &&
      newField !== "skip" &&
      m.normalizedHeader !== normalizedHeader
    ) {
      return {
        ...m,
        field: "skip" as const,
        confidence: 0.0,
        source: "user" as const,
      };
    }
    return m;
  });
}

export function validateMappings(mappings: ColumnMapping[]): {
  valid: boolean;
  missingRequired: string[];
  warnings: string[];
} {
  const mappedFields = new Set(
    mappings.filter((m) => m.field !== "skip").map((m) => m.field),
  );
  const missingRequired: string[] = [];
  const warnings: string[] = [];

  if (!mappedFields.has("name") && !mappedFields.has("mpid")) {
    missingRequired.push(
      "Minst 'Målernavn' eller 'Målepunkt-ID' må være mappet",
    );
  }

  if (!mappedFields.has("type")) {
    warnings.push(
      "Ingen 'Energitype'-kolonne funnet — alle settes til Strøm som standard",
    );
  }
  if (!mappedFields.has("meterLocation")) {
    warnings.push("Ingen 'Plassering'-kolonne funnet — plassering vil stå tom");
  }

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    warnings,
  };
}
