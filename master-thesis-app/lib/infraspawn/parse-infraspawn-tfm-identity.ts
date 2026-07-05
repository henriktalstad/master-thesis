import { parseKsTag } from "@/lib/infraspawn/ks-tag-parser";
import { isEnergyMeterEquipmentCode } from "@/lib/infraspawn/equipment-code";
import {
  type InfraspawnPointKsTag,
  parseInfraspawnPointKsTag,
} from "@/lib/infraspawn/parse-point-ks-tag";
import {
  formatSystemOccurrence,
  formatTfmElementKeyForDisplay,
  isSdAnleggsenhetElementKey,
  isThermalSystemElementKey,
  isVentilationSystemElementKey,
  normalizeTfmElementKey,
} from "@/lib/infraspawn/tfm-element-keys";
import {
  resolveSubsystemRole,
  type InfraspawnSubsystemRole,
} from "@/lib/infraspawn/tfm-subsystem-roles";

export {
  formatTfmElementKeyForDisplay,
  isSdAnleggsenhetElementKey,
  isThermalSystemElementKey,
  isVentilationSystemElementKey,
};

export type InfraspawnTfmMatchKind =
  | "ks"
  | "equipment-compact"
  | "equipment-underscore"
  | "pa-normal"
  | "source-label"
  | "inferred";

export type InfraspawnSignalRole =
  | "measured_value"
  | "setpoint"
  | "command"
  | "status"
  | "energy"
  | "flow"
  | "power"
  | "alarm"
  | "unknown";

export type InfraspawnTfmIdentity = {
  rawTag: string;
  systemCode: string;
  elementNumber: string;
  systemOccurrence: string;
  elementKey: string;
  subsystemSuffix: string | null;
  subsystemRole: InfraspawnSubsystemRole;
  equipmentCode: string | null;
  componentTypeCode: string | null;
  signalSuffix: string | null;
  signalRole: InfraspawnSignalRole;
  isEnergyMeter: boolean;
  matchKind: InfraspawnTfmMatchKind;
  confidence: "high" | "medium" | "low";
};

type ParseInput = {
  objectName?: string | null;
  description?: string | null;
  sourceLabel?: string | null;
};

const PA_NORMAL_FULL =
  /\+?\d*= ?(\d{4})\.(\d{3})(?:\.(\d{2,3}))?[- ]?([A-Z]{2,3}\d{2,4})?(?:%([A-Z]{2,3})\.(\d{3})(?:\.(\d{3}))?)?/i;

const PA_NORMAL_COMPACT =
  /^=?(\d{4})\.(\d{3})(?:\.(\d{2,3}))?[- ]?([A-Z]{2,3}\d{2,4})?/i;

function inferSignalRole(
  equipmentCode: string | null,
  signalSuffix: string | null,
  haystack: string,
): InfraspawnSignalRole {
  const suffix = signalSuffix?.toUpperCase() ?? "";
  const lower = haystack.toLowerCase();

  if (/alarm|fault|feil|brann|smoke|fire|sumalarm/.test(lower)) {
    return "alarm";
  }
  if (/^(SP|SPK)$/.test(suffix) || /setpunkt|setpoint/.test(lower)) {
    return "setpoint";
  }
  if (/^(MV|PV|CV|AV)$/.test(suffix) || /målt|measured|present value/.test(lower)) {
    return "measured_value";
  }
  if (/^(C|A|S|KOM|CMD)$/.test(suffix) || /kommando|command|styring/.test(lower)) {
    return "command";
  }
  if (/^(turtemp|returtemp|turvann|returvann)$/.test(suffix.toLowerCase())) {
    return "measured_value";
  }
  if (/effekt|power(?!.*hour)|kilowatt(?!-hour)/.test(lower)) {
    return "power";
  }
  if (/energi|energy|kwh|kilowatt-hour/.test(lower)) {
    return "energy";
  }
  if (/flow|volumstr|m3\/h/.test(lower)) {
    return "flow";
  }
  if (/volum|volume/.test(lower) && !/volumstr/.test(lower)) {
    return "flow";
  }
  if (isEnergyMeterEquipmentCode(equipmentCode)) {
    if (/effekt/.test(lower)) return "power";
    if (/energi/.test(lower)) return "energy";
    if (/flow|volum/.test(lower)) return "flow";
    return "measured_value";
  }
  if (/status|drift|run/.test(lower)) {
    return "status";
  }
  return "unknown";
}

function fromKsTag(raw: string, tag: NonNullable<ReturnType<typeof parseKsTag>>): InfraspawnTfmIdentity {
  const equipmentCode = tag.meterIndex;
  const signalSuffix = tag.variant;
  return {
    rawTag: raw,
    systemCode: tag.systemCode,
    elementNumber: tag.elementNumber,
    systemOccurrence: tag.element,
    elementKey: normalizeTfmElementKey(tag.systemCode, tag.elementNumber),
    subsystemSuffix: null,
    subsystemRole: resolveSubsystemRole(tag.systemCode, null),
    equipmentCode,
    componentTypeCode: null,
    signalSuffix,
    signalRole: inferSignalRole(equipmentCode, signalSuffix, raw),
    isEnergyMeter: tag.isEnergyMeter,
    matchKind: "ks",
    confidence: "high",
  };
}

function fromEquipmentTag(raw: string, ks: InfraspawnPointKsTag): InfraspawnTfmIdentity {
  return {
    rawTag: raw,
    systemCode: ks.systemCode,
    elementNumber: ks.elementNumber,
    systemOccurrence: ks.element,
    elementKey: ks.elementKey,
    subsystemSuffix: null,
    subsystemRole: resolveSubsystemRole(ks.systemCode, null),
    equipmentCode: ks.equipmentCode,
    componentTypeCode: null,
    signalSuffix: ks.signalSuffix,
    signalRole: inferSignalRole(ks.equipmentCode, ks.signalSuffix, raw),
    isEnergyMeter: ks.isEnergyMeter,
    matchKind:
      ks.matchKind === "equipment-underscore"
        ? "equipment-underscore"
        : "equipment-compact",
    confidence: "high",
  };
}

function fromPaParts(
  raw: string,
  systemCode: string,
  elementNumber: string,
  subsystemSuffix: string | null,
  equipmentCode: string | null,
  componentTypeCode: string | null,
): InfraspawnTfmIdentity {
  const subsystemRole = resolveSubsystemRole(systemCode, subsystemSuffix);
  return {
    rawTag: raw,
    systemCode,
    elementNumber,
    systemOccurrence: formatSystemOccurrence(
      systemCode,
      elementNumber,
      subsystemSuffix,
    ),
    elementKey: normalizeTfmElementKey(systemCode, elementNumber),
    subsystemSuffix,
    subsystemRole,
    equipmentCode: equipmentCode?.toUpperCase() ?? null,
    componentTypeCode,
    signalSuffix: null,
    signalRole: inferSignalRole(equipmentCode, null, raw),
    isEnergyMeter: isEnergyMeterEquipmentCode(equipmentCode),
    matchKind: "pa-normal",
    confidence: "high",
  };
}

function tryParsePaNormal(raw: string): InfraspawnTfmIdentity | null {
  const trimmed = raw.trim();
  const full = trimmed.match(PA_NORMAL_FULL);
  if (full) {
    const [, systemCode, elementNumber, subsystem, equipment, compPrefix, compNum] =
      full;
    if (systemCode && elementNumber) {
      const componentTypeCode =
        compPrefix && compNum ? `${compPrefix.toUpperCase()}.${compNum}` : null;
      return fromPaParts(
        trimmed,
        systemCode,
        elementNumber,
        subsystem ?? null,
        equipment?.toUpperCase() ?? null,
        componentTypeCode,
      );
    }
  }

  const compact = trimmed.match(PA_NORMAL_COMPACT);
  if (compact) {
    const [, systemCode, elementNumber, subsystem, equipment] = compact;
    if (systemCode && elementNumber) {
      return fromPaParts(
        trimmed,
        systemCode,
        elementNumber,
        subsystem ?? null,
        equipment?.toUpperCase() ?? null,
        null,
      );
    }
  }

  return null;
}

function tryParseCandidate(raw: string): InfraspawnTfmIdentity | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const pa = tryParsePaNormal(trimmed);
  if (pa) return pa;

  const ks = parseKsTag(trimmed);
  if (ks) return fromKsTag(trimmed, ks);

  const equipmentTag = parseInfraspawnPointKsTag({ objectName: trimmed });
  if (equipmentTag) return fromEquipmentTag(trimmed, equipmentTag);

  return null;
}

export function parseInfraspawnTfmIdentity(
  input: ParseInput,
): InfraspawnTfmIdentity | null {
  const candidates = [input.objectName, input.sourceLabel, input.description];
  for (const candidate of candidates) {
    const parsed = tryParseCandidate(candidate ?? "");
    if (parsed) return parsed;
  }
  return null;
}
