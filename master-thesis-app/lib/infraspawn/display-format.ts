import { formatInfraspawnUnit } from "@/lib/infraspawn/format-unit";
import { humanizeInfraspawnPointLabel } from "@/lib/infraspawn/point-display-labels";
import type { InfraspawnPointHaystackInput } from "@/lib/infraspawn/point-haystack";
import { infraspawnPointHaystack } from "@/lib/infraspawn/point-haystack";
import {
  type InfraspawnBinarySignalInput,
  isInfraspawnBinarySignal,
} from "@/lib/infraspawn/point-status";
import {
  formatSystemairMsvValue,
  formatSystemairOperatorMsvValue,
} from "@/lib/sd-anlegg/systemair-msv-labels";
import {
  formatValveCommandPercentDisplay,
  isAoValveCommandSignal,
} from "@/lib/sd-anlegg/valve-command-percent";

const OSLO_MEDIUM_SHORT = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

const NB_NO_NUMBER = new Intl.NumberFormat("nb-NO", {
  maximumFractionDigits: 2,
});

function resolveInfraspawnSyncAge(
  iso: string | null,
  now: Date = new Date(),
): {
  kind: "missing" | "invalid" | "now" | "minutes" | "hours" | "absolute";
  minutes?: number;
  hours?: number;
  date?: Date;
} {
  if (!iso) return { kind: "missing" };

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { kind: "invalid" };

  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (diffMin < 1) return { kind: "now" };
  if (diffMin < 60) return { kind: "minutes", minutes: diffMin };

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return { kind: "hours", hours: diffHours };

  return { kind: "absolute", date };
}

export function formatInfraspawnRelativeSyncAge(iso: string | null): string {
  const age = resolveInfraspawnSyncAge(iso);
  switch (age.kind) {
    case "missing":
      return "venter på første sync";
    case "invalid":
      return "ukjent tid";
    case "now":
      return "nå";
    case "minutes":
      return `${age.minutes} min siden`;
    case "hours":
      return age.hours === 1 ? "1 time siden" : `${age.hours} timer siden`;
    case "absolute":
      return OSLO_MEDIUM_SHORT.format(age.date!);
  }
}

export function formatInfraspawnSyncTime(iso: string | null): string {
  const age = resolveInfraspawnSyncAge(iso);
  switch (age.kind) {
    case "missing":
      return "Venter på første oppdatering";
    case "invalid":
      return "Ukjent tid";
    case "now":
      return "Oppdatert nå";
    case "minutes":
      return `Oppdatert for ${age.minutes} min siden`;
    case "hours":
      return age.hours === 1
        ? "Oppdatert for 1 time siden"
        : `Oppdatert for ${age.hours} timer siden`;
    case "absolute":
      return formatInfraspawnAlarmTimestamp(iso);
  }
}

/** Relativ alder for måling — brukes som primær bruker-copy. */
export function formatRelativeMeasurementAge(
  iso: string | null,
  now: Date = new Date(),
): string {
  const age = resolveInfraspawnSyncAge(iso, now);
  switch (age.kind) {
    case "missing":
      return "ukjent tid";
    case "invalid":
      return "ukjent tid";
    case "now":
      return "nå";
    case "minutes":
      return `${age.minutes} min siden`;
    case "hours":
      return age.hours === 1 ? "1 time siden" : `${age.hours} timer siden`;
    case "absolute":
      return formatInfraspawnAlarmTimestamp(iso);
  }
}

/** Full etikett: «Sist oppdatert …» */
export function formatLastUpdated(iso: string | null): string {
  const age = resolveInfraspawnSyncAge(iso);
  switch (age.kind) {
    case "missing":
      return "Sist oppdatert: ukjent";
    case "invalid":
      return "Sist oppdatert: ukjent";
    case "now":
      return "Sist oppdatert nå";
    case "minutes":
      return `Sist oppdatert for ${age.minutes} min siden`;
    case "hours":
      return age.hours === 1
        ? "Sist oppdatert for 1 time siden"
        : `Sist oppdatert for ${age.hours} timer siden`;
    case "absolute":
      return `Sist oppdatert ${formatInfraspawnAlarmTimestamp(iso)}`;
  }
}

export function formatInfraspawnAlarmTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Ukjent tid";
  return OSLO_MEDIUM_SHORT.format(date);
}

const ACTIVE_ALARM_RELATIVE_DAYS = 7;

/** Relativ alder for aktive alarmer — opptil 7 dager, deretter absolutt dato. */
export function formatActiveAlarmAge(iso: string): string {
  const age = resolveInfraspawnSyncAge(iso);
  switch (age.kind) {
    case "missing":
    case "invalid":
      return "—";
    case "now":
      return "nå";
    case "minutes":
      return `${age.minutes} min siden`;
    case "hours":
      return age.hours === 1 ? "1 time siden" : `${age.hours} timer siden`;
    case "absolute": {
      const diffDays = Math.floor(
        (Date.now() - age.date!.getTime()) / 86_400_000,
      );
      if (diffDays < ACTIVE_ALARM_RELATIVE_DAYS) {
        return diffDays === 1 ? "1 dag siden" : `${diffDays} dager siden`;
      }
      return formatInfraspawnAlarmTimestamp(iso);
    }
  }
}

export function formatInfraspawnMeasurementCount(count: number): string {
  return count.toLocaleString("nb-NO");
}

export function formatInfraspawnPointLabel(
  point: InfraspawnPointHaystackInput,
): string {
  const humanized = humanizeInfraspawnPointLabel(point);
  if (humanized) return humanized;

  const name = point.objectName?.trim();
  if (name && name !== point.objectId) return name;
  const description = point.description?.trim();
  if (description) return description;
  return point.objectId;
}

function formatInfraspawnBinaryPointValue(
  value: number,
  point: InfraspawnBinarySignalInput,
): string {
  const haystack = infraspawnPointHaystack(point);
  if (/pjeld|spjeld|damper|KA\d/i.test(haystack)) {
    return value === 0 ? "LUKKET" : "ÅPEN";
  }
  if (/conterror|cont\.?\s*error|følgefeil/i.test(haystack)) {
    return value === 0 ? "Normal" : "Alarm";
  }
  if (/vifte|fan|pumpe|pump|start|drift/i.test(haystack)) {
    return value === 0 ? "AV" : "PÅ";
  }
  if (/systemstatus|unitmode|frostvakt|frostrisk|status/i.test(haystack)) {
    return value === 0 ? "Normal" : "Aktiv";
  }
  if (/rotationguard|rotasjonsvakt|lowefficiency|lav.*virkningsgrad/i.test(haystack)) {
    return value === 0 ? "Normal" : "Alarm";
  }
  return value === 0 ? "AV" : "PÅ";
}

export function formatInfraspawnVentilationAutoModeValue(
  value: number,
  point: InfraspawnPointHaystackInput,
): string | null {
  const msv = formatSystemairMsvValue(value, point);
  if (msv) return msv;

  const name = (point.objectName ?? "").trim().toUpperCase();
  const haystack = infraspawnPointHaystack(point);
  if (!/AUTOMODE|AIRUNITAUTOMODE/.test(name) && !/AUTOMODE/.test(haystack)) {
    return null;
  }
  if (value === 0) return "Av";
  if (value === 1) return "På";
  if (value === 2) return "Auto";
  return `Modus ${value}`;
}

export type InfraspawnPointValueParts =
  | { kind: "empty" }
  | { kind: "text"; text: string }
  | { kind: "numeric"; value: string; unit: string | null };

export function formatInfraspawnPointValueParts(
  value: number | null,
  unit: string | null,
  point?: InfraspawnBinarySignalInput,
): InfraspawnPointValueParts {
  if (value == null || Number.isNaN(value)) return { kind: "empty" };

  if (point && isInfraspawnBinarySignal(point)) {
    return {
      kind: "text",
      text: formatInfraspawnBinaryPointValue(value, point),
    };
  }

  if (point) {
    const msv = formatSystemairOperatorMsvValue(value, point);
    if (msv) {
      return { kind: "text", text: msv };
    }

    const autoMode = formatInfraspawnVentilationAutoModeValue(value, point);
    if (autoMode) {
      return { kind: "text", text: autoMode };
    }

    if (isAoValveCommandSignal(point)) {
      const pctText = formatValveCommandPercentDisplay({
        ...point,
        lastValue: value,
      });
      if (pctText) {
        return { kind: "text", text: pctText };
      }
    }
  }

  const formatted = NB_NO_NUMBER.format(value);
  const unitLabel = formatInfraspawnUnit(unit);
  return { kind: "numeric", value: formatted, unit: unitLabel };
}

export function formatInfraspawnPointValue(
  value: number | null,
  unit: string | null,
  point?: InfraspawnBinarySignalInput,
): string {
  const parts = formatInfraspawnPointValueParts(value, unit, point);
  if (parts.kind === "empty") return "—";
  if (parts.kind === "text") return parts.text;
  return parts.unit ? `${parts.value} ${parts.unit}` : parts.value;
}

export { formatInfraspawnUnit } from "@/lib/infraspawn/format-unit";

export function minutesSinceIso(
  iso: string | null,
  now: Date = new Date(),
): number | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.round((now.getTime() - ts) / 60_000));
}
