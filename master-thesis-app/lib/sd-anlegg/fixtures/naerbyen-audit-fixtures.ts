import type { SdComponentType } from "../component-types";

export type NaerbyenAuditFixture = {
  objectId: string;
  objectName: string | null;
  description: string | null;
  unit: string | null;
  expectedType: SdComponentType;
};

/** Nærbyen / 360.102 ventilasjonssignaler for heuristikk-audit og seed-layout. */
export const NAERBYEN_AUDIT_FIXTURES: NaerbyenAuditFixture[] = [
  {
    objectId: "AO-501",
    objectName: "JV501",
    description: "Tilluftsvifte",
    unit: "cubic-meters-per-hour",
    expectedType: "ventilation.fan",
  },
  {
    objectId: "AO-502",
    objectName: "JV502",
    description: "Avtrekksvifte",
    unit: "cubic-meters-per-hour",
    expectedType: "ventilation.fan",
  },
  {
    objectId: "BO-501",
    objectName: "KA501",
    description: "Tilluftspjeld",
    unit: "boolean",
    expectedType: "ventilation.damper",
  },
  {
    objectId: "BO-502",
    objectName: "KA502",
    description: "Avtrekkspjeld",
    unit: "boolean",
    expectedType: "ventilation.damper",
  },
  {
    objectId: "AI-401f",
    objectName: "QD401",
    description: "Filtervakt inntak",
    unit: "pascals",
    expectedType: "ventilation.filter",
  },
  {
    objectId: "AI-501",
    objectName: "QD501",
    description: "Filtervakt avtrekk",
    unit: "pascals",
    expectedType: "ventilation.filter",
  },
  {
    objectId: "AI-471",
    objectName: "LX471",
    description: "Varmegjenvinner",
    unit: "percent",
    expectedType: "ventilation.heat_recovery",
  },
  {
    objectId: "AI-401",
    objectName: "RT401",
    description: "Tilluftstemperatur",
    unit: "degrees-celsius",
    expectedType: "sensor.temperature",
  },
  {
    objectId: "AI-402",
    objectName: "310.001RT402_SP",
    description: "Setpunkt retur",
    unit: "degrees-celsius",
    expectedType: "sensor.temperature",
  },
  {
    objectId: "AI-403",
    objectName: "320001OE001_turtemp",
    description: "Turtemperatur",
    unit: "degrees-celsius",
    expectedType: "sensor.temperature",
  },
  {
    objectId: "AI-404",
    objectName: "320001OE001_returtemp",
    description: "Returtemperatur",
    unit: "degrees-celsius",
    expectedType: "sensor.temperature",
  },
  {
    objectId: "AV-40300",
    objectName: "AI_EAFPressure",
    description: "Trykk avtrekk",
    unit: "pascals",
    expectedType: "sensor.pressure",
  },
  {
    objectId: "BO-601",
    objectName: "Systemstatus",
    description: null,
    unit: "boolean",
    expectedType: "binary.status",
  },
  {
    objectId: "BO-602",
    objectName: "Frostvakt",
    description: null,
    unit: "boolean",
    expectedType: "binary.status",
  },
  {
    objectId: "AO-701",
    objectName: "JP401",
    description: "Sirkulasjonspumpe",
    unit: "boolean",
    expectedType: "hvac.pump",
  },
  {
    objectId: "AO-702",
    objectName: "SB501",
    description: "Varmeventil",
    unit: "percent",
    expectedType: "hvac.valve",
  },
];

export const NAERBYEN_VENTILATION_FIXTURES = NAERBYEN_AUDIT_FIXTURES;
