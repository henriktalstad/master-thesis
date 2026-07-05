import { formatInfraspawnPointLabel } from "@/lib/infraspawn/display-format";

const BACNET_OBJECT_REF = /^(AI|AO|AV|BI|BO|BV|MSV)-\d+$/i;
const STRUCTURED_OBJECT_ID = /^\d{3}[._]\d{3}[A-Z]{2}\d{3}/i;

function isRoomTemperatureSensorObjectId(objectId: string): boolean {
  return /RT\d{3}_MV/i.test(objectId);
}

function inferAlarmTitleFromObjectId(objectId: string): string {
  const haystack = objectId.toLowerCase();
  if (/\bretur\b|rp\d|_rp/i.test(haystack)) return "Returtemperatur";
  if (/\btt\b|tur|supply/.test(haystack)) return "Turtemperatur";
  if (/ute|outdoor|ot\d|901/.test(haystack)) return "Utetemperatur";
  if (/effekt|power|kw|e001/.test(haystack)) return "Effekt";
  if (/mv|ventil|valve|vav/.test(haystack)) return "Ventilasjon";
  if (/alarm|fault|feil/.test(haystack)) return "Alarm";
  return "Alarm";
}

export function isTechnicalAlarmSignalRef(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (BACNET_OBJECT_REF.test(trimmed)) return true;
  if (STRUCTURED_OBJECT_ID.test(trimmed)) return true;
  if (
    /^[A-Z0-9][A-Z0-9._-]*$/i.test(trimmed) &&
    (trimmed.includes(".") || trimmed.includes("_"))
  ) {
    return true;
  }
  return false;
}

export function resolveAlarmSignalTitle(input: {
  alarmText: string;
  objectId: string;
  objectName?: string | null;
  description?: string | null;
}): string {
  const alarmText = input.alarmText.trim();
  const objectId = input.objectId.trim();
  const objectName = input.objectName?.trim() || null;
  const description = input.description?.trim() || null;

  if (alarmText && !isTechnicalAlarmSignalRef(alarmText)) {
    return alarmText;
  }

  if (objectId && isRoomTemperatureSensorObjectId(objectId)) {
    return "Romtemperatur";
  }

  const humanized = formatInfraspawnPointLabel({
    objectId,
    objectName,
    description,
    unit: null,
  });

  if (!isTechnicalAlarmSignalRef(humanized)) {
    return humanized;
  }

  if (objectName && !isTechnicalAlarmSignalRef(objectName)) {
    return objectName;
  }

  if (description && !isTechnicalAlarmSignalRef(description)) {
    return description;
  }

  if (objectId && objectId !== alarmText && !isTechnicalAlarmSignalRef(objectId)) {
    return objectId;
  }

  return inferAlarmTitleFromObjectId(objectId);
}
