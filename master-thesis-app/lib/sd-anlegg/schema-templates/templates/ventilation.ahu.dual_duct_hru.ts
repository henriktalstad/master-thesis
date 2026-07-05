import { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import { buildAhuSchematicAlarmTemplateNodes } from "../../ahu-schematic-alarm-indicators";
import type { SchemaTemplate } from "../types";

/** AHU: tilluft / avtrekk / VGX / varmebatteri-gren / drift. */
export const VENTILATION_AHU_DUAL_DUCT_HRU: SchemaTemplate = {
  id: "ventilation.ahu.dual_duct_hru",
  version: 1,
  name: "Ventilasjonsaggregat",
  domains: [InfraspawnSystemDomain.VENTILATION],
  elementKeyHint: ["360101", "360102", "360201"],
  nodes: [
    {
      id: "supply.damper",
      role: "supply.damper",
      lane: "supply",
      componentType: "ventilation.damper",
      label: "Tilluftspjeld",
      displayOrder: 0,
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentCode", prefix: "KA", lane: "supply" },
          {
            kind: "namedSignal",
            patterns: ["DO_SADamper", "BO_SADamper", "SA_Damper", "KA401", "KA501"],
          },
        ],
      },
    },
    {
      id: "supply.fan",
      role: "supply.fan",
      lane: "supply",
      componentType: "ventilation.fan",
      label: "Tilluftsvifte",
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentCode", prefix: "JV", lane: "supply" },
          {
            kind: "namedSignal",
            patterns: [
              "AI_SAFFlow",
              "AI_SAFPressure",
              "SAFFlow",
              "SAFPressure",
              "AO_SAF",
              "DO_SAFStart",
            ],
          },
        ],
      },
    },
    {
      id: "heat_recovery.unit",
      role: "heat_recovery.unit",
      lane: "heat_recovery",
      componentType: "ventilation.heat_recovery",
      label: "Varmegjenvinner",
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentCode", prefix: "LX", lane: "heat_recovery" },
          {
            kind: "namedSignal",
            patterns: [
              "Efficiency",
              "AI_Efficiency",
              "Lowefficiency",
              "Rotationguardexchanger",
              "360102_LX471_KV",
              "360102_LX471_C",
              "LX471_C",
            ],
          },
        ],
      },
    },
    {
      id: "supply.filter",
      role: "supply.filter",
      lane: "supply",
      componentType: "ventilation.filter",
      label: "Filtervakt inntak",
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentDigits", prefix: "QD", digits: "401" },
          {
            kind: "namedSignal",
            patterns: ["AI_FilterGuard1", "360102_QD401_PV", "QD401"],
          },
        ],
      },
    },
    {
      id: "supply.temp",
      role: "supply.temp",
      lane: "supply",
      componentType: "sensor.temperature",
      label: "Tilluft TEMP ut",
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentDigits", prefix: "RT", digits: "401" },
          {
            kind: "namedSignal",
            patterns: ["RT401", "AI_SupplyAirTemp", "SupplyAirTemp"],
          },
        ],
      },
    },
    {
      id: "exhaust.temp",
      role: "exhaust.temp",
      lane: "exhaust",
      componentType: "sensor.temperature",
      label: "Avtrekk TEMP ut",
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentDigits", prefix: "RT", digits: "501" },
          {
            kind: "namedSignal",
            patterns: ["RT501", "AI_ExtractAirTemp", "ExtractAirTemp"],
          },
        ],
      },
    },
    {
      id: "supply.temp_in",
      role: "supply.temp_in",
      lane: "supply",
      componentType: "sensor.temperature",
      label: "Inntak TEMP",
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentDigits", prefix: "RT", digits: "901" },
          {
            kind: "namedSignal",
            patterns: ["RT901", "AI_IntakeAirTemp", "IntakeAirTemp"],
          },
        ],
      },
    },
    {
      id: "supply.temp_mid",
      role: "supply.temp_mid",
      lane: "supply",
      componentType: "sensor.temperature",
      label: "Tilluft etter VGX",
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentDigits", prefix: "RT", digits: "402" },
          {
            kind: "namedSignal",
            patterns: [
              "RT402",
              "RT402_MV",
              "AI_AfterHXTemp",
              "AfterHXTemp",
              "SupplyAirTempMid",
            ],
          },
        ],
      },
    },
    {
      id: "exhaust.damper",
      role: "exhaust.damper",
      lane: "exhaust",
      componentType: "ventilation.damper",
      label: "Avtrekkspjeld",
      displayOrder: 0,
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentCode", prefix: "KA", lane: "exhaust" },
          {
            kind: "namedSignal",
            patterns: ["DO_EADamper", "BO_EADamper", "EA_Damper", "KA501", "KA502"],
          },
        ],
      },
    },
    {
      id: "exhaust.filter",
      role: "exhaust.filter",
      lane: "exhaust",
      componentType: "ventilation.filter",
      label: "Filtervakt avtrekk",
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentDigits", prefix: "QD", digits: "501" },
          {
            kind: "namedSignal",
            patterns: ["AI_FilterGuard2", "360102_QD501_PV", "QD501"],
          },
        ],
      },
    },
    {
      id: "exhaust.temp_in",
      role: "exhaust.temp_in",
      lane: "exhaust",
      componentType: "sensor.temperature",
      label: "Avtrekk TEMP",
      displayOrder: 2,
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentDigits", prefix: "RT", digits: "901" },
          {
            kind: "namedSignal",
            patterns: ["RT901", "AI_ExtractAirTemp", "ExtractAirTemp"],
          },
        ],
      },
    },
    {
      id: "exhaust.fan",
      role: "exhaust.fan",
      lane: "exhaust",
      componentType: "ventilation.fan",
      label: "Avtrekksvifte",
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentCode", prefix: "JV", lane: "exhaust" },
          {
            kind: "namedSignal",
            patterns: [
              "AI_EAFFlow",
              "AI_EAFPressure",
              "EAFFlow",
              "EAFPressure",
              "AO_EAF",
              "DO_EAFStart",
            ],
          },
        ],
      },
    },
    {
      id: "status.setpoint",
      role: "status.setpoint",
      lane: "status",
      componentType: "sensor.temperature",
      label: "Kalkulert verdi",
      displayOrder: 3,
      bind: {
        kind: "namedSignal",
        patterns: [
          "360102_RT401_SPK",
          "SupplyPID_SetP",
          "CalculatedValue",
          "Kalkulert",
          "360102_RT401_SP",
          "SupplySetpoint",
          "RT402_SP",
          "310.001RT402_SP",
          "RT402_SPK",
        ],
      },
    },
    {
      id: "exhaust.temp_mid",
      role: "exhaust.temp_mid",
      lane: "exhaust",
      componentType: "sensor.temperature",
      label: "Avtrekk etter VGX",
      bind: { kind: "signalRole", equipmentPrefix: "RT", suffix: "MV" },
    },
    {
      id: "heating.valve",
      role: "heating.valve",
      lane: "heating",
      componentType: "hvac.valve",
      label: "Varmeventil",
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentDigits", prefix: "SB", digits: "401" },
          { kind: "namedSignal", patterns: ["SB401", "AO_3", "360102_SB401_C"] },
        ],
      },
    },
    {
      id: "heating.cool_valve",
      role: "heating.cool_valve",
      lane: "heating",
      componentType: "hvac.valve",
      label: "Kjøleventil",
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentDigits", prefix: "SB", digits: "501" },
          { kind: "namedSignal", patterns: ["SB501", "AO_5", "360102_SB501_C"] },
        ],
      },
    },
    {
      id: "heating.pump",
      role: "heating.pump",
      lane: "heating",
      componentType: "hvac.pump",
      label: "Sirkulasjonspumpe",
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentDigits", prefix: "JP", digits: "401" },
          {
            kind: "namedSignal",
            patterns: [
              "DO_SeqPumpY1",
              "DO_SeqPumpY2",
              "DOSelect_SeqPumpY1",
              "DOSelect_SeqPumpY2",
              "Malf_pumpheater",
              "Malf_pumpcooler",
              "SeqPump",
              "360102_JP401_S",
              "360102_JP501_S",
            ],
          },
        ],
      },
    },
    {
      id: "heating.temp",
      role: "heating.temp",
      lane: "heating",
      componentType: "sensor.temperature",
      label: "Varmebatteri TEMP",
      displayOrder: 2,
      bind: {
        kind: "anyOf",
        rules: [
          { kind: "equipmentDigits", prefix: "RT", digits: "550" },
          {
            kind: "namedSignal",
            patterns: [
              "RT550",
              "AI_SupplyCoilTemp",
              "SupplyCoilTemp",
              "AI_FrostprotTemp1",
              "360102_RT550_MV",
            ],
          },
        ],
      },
    },
    {
      id: "status.system",
      role: "status.system",
      lane: "status",
      componentType: "binary.status",
      label: "Systemstatus",
      bind: { kind: "namedSignal", patterns: ["Systemstatus", "UnitMode"] },
    },
    {
      id: "status.frost",
      role: "status.frost",
      lane: "status",
      componentType: "binary.status",
      label: "Frostvakt",
      bind: { kind: "namedSignal", patterns: ["Frostvakt", "Frostrisk", "360102_FROST"] },
    },
    {
      id: "status.schedule",
      role: "status.schedule",
      lane: "status",
      componentType: "binary.status",
      label: "Tidsprogram",
      bind: {
        kind: "namedSignal",
        patterns: [
          "Tidsprogram",
          "TimeSchedule",
          "Schedule",
          "AirUnitAutoMode",
          "EAFAutoMode",
          "SAFAutoMode",
        ],
      },
    },
    {
      id: "status.sfp",
      role: "status.sfp",
      lane: "status",
      componentType: "generic.signal",
      label: "SFP",
      displayOrder: 2,
      bind: {
        kind: "namedSignal",
        patterns: ["SFP", "RT402_SPF", "AI_SFP", "SpecificFanPower"],
      },
    },
    ...buildAhuSchematicAlarmTemplateNodes(),
  ],
  edges: [
    { source: "supply.damper", target: "supply.fan", edgeType: "duct" },
    { source: "supply.fan", target: "heat_recovery.unit", edgeType: "duct" },
    { source: "heat_recovery.unit", target: "supply.filter", edgeType: "duct" },
    { source: "supply.filter", target: "supply.temp", edgeType: "duct" },
    { source: "exhaust.damper", target: "exhaust.filter", edgeType: "duct" },
    { source: "exhaust.filter", target: "exhaust.temp_in", edgeType: "duct" },
    { source: "exhaust.temp_in", target: "heat_recovery.unit", edgeType: "duct" },
    { source: "heat_recovery.unit", target: "exhaust.temp_mid", edgeType: "duct" },
    { source: "exhaust.temp_mid", target: "exhaust.fan", edgeType: "duct" },
    { source: "heating.valve", target: "heating.pump", edgeType: "pipe" },
    { source: "heating.pump", target: "heating.temp", edgeType: "pipe" },
  ],
};
