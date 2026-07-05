import type { InfraspawnPointHaystackInput } from "@/lib/infraspawn/point-haystack";
import { infraspawnPointHaystack } from "@/lib/infraspawn/point-haystack";

export type SystemairMsvKind =
  | "plant_run_mode"
  | "corrigo_run_mode"
  | "air_unit_auto_mode"
  | "fan_auto_mode"
  | "pump_command_mode"
  | null;

function pointName(point: InfraspawnPointHaystackInput): string {
  return (point.objectName ?? point.objectId ?? "").trim().toUpperCase();
}

function pointId(point: InfraspawnPointHaystackInput): string {
  return (point.objectId ?? "").trim().toUpperCase();
}

/** Pumpekommando (DOSelect / SeqPump) og MSVV med ren «Run mode» uten aggregat/vifte. */
export function isSystemairPumpCommandPoint(
  point: InfraspawnPointHaystackInput,
): boolean {
  const name = pointName(point);
  const id = pointId(point);
  const haystack = infraspawnPointHaystack(point).toUpperCase();

  if (/DOSELECT|SEQPUMP.*KMD|_KMD\b/.test(name)) {
    return true;
  }

  if (!/^MSVV-/.test(id)) {
    return false;
  }

  if (/EAFAUTOMODE|SAFAUTOMODE|AIRUNITAUTOMODE/.test(name)) {
    return false;
  }
  if (/UNITMODE|SYSTEMSTATUS|PLANTMODE/.test(name)) {
    return false;
  }
  if (/RUNNING MODE AIR UNIT|RUNNING MODE (EAF|SAF)/.test(haystack)) {
    return false;
  }
  if (/DRIFTSMODUS|TIDSPROGRAM|FORLENGET DRIFT|KMD_MSV/.test(haystack)) {
    return false;
  }

  if (/PUMPE|PUMP|SEQPUMP|JP401|JP501|JP402/.test(haystack)) {
    return true;
  }

  if (/\bRUN\s*MODE\b/.test(haystack) || /RUNNING MODE/.test(haystack)) {
    return !/AIR UNIT/.test(haystack);
  }

  return false;
}

export function resolveSystemairMsvKind(
  point: InfraspawnPointHaystackInput,
): SystemairMsvKind {
  const name = pointName(point);
  const haystack = infraspawnPointHaystack(point).toUpperCase();

  if (
    /PLANTMODE|UNITRUNMODE/.test(name) ||
    /PLANT\s*MODE|UNIT RUN MODE/.test(haystack)
  ) {
    return "plant_run_mode";
  }

  if (
    /AIRUNITAUTOMODE/.test(name) ||
    /RUNNING MODE AIR UNIT/.test(haystack) ||
    (/^MSVV-/.test(pointId(point)) &&
      /DRIFTSMODUS AGGREGAT|TIDSPROGRAM|FORLENGET DRIFT|KMD_MSV/.test(haystack))
  ) {
    return "air_unit_auto_mode";
  }

  if (/EAFAUTOMODE|SAFAUTOMODE/.test(name) || /RUNNING MODE (EAF|SAF)/.test(haystack)) {
    return "fan_auto_mode";
  }

  if (
    name === "UNITMODE" ||
    name === "SYSTEMSTATUS" ||
    /\bCOR_RUNMODE\b/.test(haystack)
  ) {
    if (!/PLANT/.test(haystack)) return "corrigo_run_mode";
  }

  if (
    /\bRUN\s*MODE\b/.test(haystack) &&
    !/^MSVV-/.test(pointId(point)) &&
    !/AIR UNIT/.test(haystack) &&
    !/RUNNING MODE (EAF|SAF)/.test(haystack)
  ) {
    if (!/PLANT/.test(haystack)) return "corrigo_run_mode";
  }

  if (isSystemairPumpCommandPoint(point)) {
    return "pump_command_mode";
  }

  return null;
}

/** Plantmode / Cor_UnitRunMode (BACnet 1-indeksert). */
export function formatSystemairPlantRunModeValue(value: number): string {
  switch (value) {
    case 1:
      return "Av";
    case 2:
      return "Redusert hastighet";
    case 3:
      return "Normal hastighet";
    case 4:
      return "Stopp pga. alarm";
    default:
      return value === 0 ? "Av" : `Modus ${value}`;
  }
}

/** Cor_RunMode — sekvens/status under oppstart og drift. */
export function formatSystemairCorrigoRunModeValue(value: number): string {
  switch (value) {
    case 1:
      return "Stoppet";
    case 2:
      return "Oppstart";
    case 3:
      return "Oppstart redusert";
    case 4:
      return "Oppstart full hastighet";
    case 5:
      return "Oppstart normal drift";
    case 6:
      return "Normal drift";
    case 7:
      return "Støttekontroll varme";
    case 8:
      return "Støttekontroll kjøling";
    case 9:
      return "CO₂-drift";
    case 10:
      return "Nattskjøling";
    case 11:
      return "Stopp full hastighet";
    case 12:
      return "Stopper vifte";
    default:
      return value === 0 ? "Stoppet" : `Modus ${value}`;
  }
}

/** AirUnitAutoMode — manuell/auto for hele aggregatet. */
export function formatSystemairAirUnitAutoModeValue(value: number): string {
  switch (value) {
    case 1:
      return "Manuell av";
    case 2:
      return "Manuell redusert";
    case 3:
      return "Manuell normal";
    case 4:
      return "Auto";
    default:
      return value === 0 ? "Av" : `Modus ${value}`;
  }
}

/** DOSelect_SeqPumpY* / MSVV pumpestatus. */
export function formatSystemairPumpCommandModeValue(value: number): string {
  switch (value) {
    case 0:
      return "Av";
    case 1:
      return "På";
    case 2:
    case 3:
      return "Auto";
    default:
      return value === 0 ? "Av" : `Modus ${value}`;
  }
}

/** EAFAutoMode / SAFAutoMode. */
export function formatSystemairFanAutoModeValue(value: number): string {
  switch (value) {
    case 1:
      return "Av";
    case 2:
      return "Manuell halv";
    case 3:
      return "Manuell full";
    case 4:
      return "Auto";
    default:
      return value === 0 ? "Av" : `Modus ${value}`;
  }
}

function isAhuUnitModeStatusPoint(point: InfraspawnPointHaystackInput): boolean {
  const name = pointName(point);
  return name === "UNITMODE" || name === "SYSTEMSTATUS";
}

/** Operatørvisning for AHU UnitMode/Systemstatus — ikke rå Corrigo-sekvens. */
function formatAhuOperatorCorrigoRunModeValue(value: number): string | null {
  if (Math.round(value) === 4) return "Normal hastighet";
  return null;
}

function formatAhuOperatorCorrigoRunModeAxisTick(value: number): string | null {
  if (Math.round(value) === 4) return "Normal";
  return null;
}

/** Brukervendt MSV-tekst (stripe, historikk, tooltip) — teknisk mapping beholdes i formatSystemairMsvValue. */
export function formatSystemairOperatorMsvValue(
  value: number,
  point: InfraspawnPointHaystackInput,
): string | null {
  if (!Number.isFinite(value)) return null;

  if (
    resolveSystemairMsvKind(point) === "corrigo_run_mode" &&
    isAhuUnitModeStatusPoint(point)
  ) {
    const operator = formatAhuOperatorCorrigoRunModeValue(value);
    if (operator) return operator;
  }

  return formatSystemairMsvValue(value, point);
}

/** Korte akse-etiketter for operatørvisning i MSV-grafer. */
export function formatSystemairOperatorMsvAxisTick(
  value: number,
  point: InfraspawnPointHaystackInput,
): string {
  const rounded = Math.round(value);

  if (
    resolveSystemairMsvKind(point) === "corrigo_run_mode" &&
    isAhuUnitModeStatusPoint(point)
  ) {
    const operator = formatAhuOperatorCorrigoRunModeAxisTick(rounded);
    if (operator) return operator;
  }

  return formatSystemairMsvAxisTick(rounded, point);
}

export function formatSystemairMsvValue(
  value: number,
  point: InfraspawnPointHaystackInput,
): string | null {
  if (!Number.isFinite(value)) return null;

  switch (resolveSystemairMsvKind(point)) {
    case "plant_run_mode":
      return formatSystemairPlantRunModeValue(value);
    case "corrigo_run_mode":
      return formatSystemairCorrigoRunModeValue(value);
    case "air_unit_auto_mode":
      return formatSystemairAirUnitAutoModeValue(value);
    case "fan_auto_mode":
      return formatSystemairFanAutoModeValue(value);
    case "pump_command_mode":
      return formatSystemairPumpCommandModeValue(value);
    default:
      return null;
  }
}

/** Korte akse-etiketter for MSV-grafer. */
export function formatSystemairMsvAxisTick(
  value: number,
  point: InfraspawnPointHaystackInput,
): string {
  const rounded = Math.round(value);
  switch (resolveSystemairMsvKind(point)) {
    case "plant_run_mode":
      switch (rounded) {
        case 1:
          return "Av";
        case 2:
          return "Redusert";
        case 3:
          return "Normal";
        case 4:
          return "Alarm";
      }
      break;
    case "air_unit_auto_mode":
      switch (rounded) {
        case 1:
          return "Man. av";
        case 2:
          return "Man. red.";
        case 3:
          return "Man. normal";
        case 4:
          return "Auto";
      }
      break;
    case "fan_auto_mode":
      switch (rounded) {
        case 1:
          return "Av";
        case 2:
          return "Man. ½";
        case 3:
          return "Man. full";
        case 4:
          return "Auto";
      }
      break;
    case "pump_command_mode":
      switch (rounded) {
        case 0:
          return "Av";
        case 1:
          return "På";
        case 2:
        case 3:
          return "Auto";
      }
      break;
    case "corrigo_run_mode":
      switch (rounded) {
        case 1:
          return "Stoppet";
        case 2:
          return "Oppstart";
        case 3:
          return "Oppst. red.";
        case 4:
          return "Oppst. full";
        case 5:
          return "Oppst. normal";
        case 6:
          return "Normal";
        case 11:
          return "Stopp full";
        case 12:
          return "Stopper";
      }
      break;
  }

  const full = formatSystemairMsvValue(rounded, point);
  if (full) return full.length > 14 ? `${full.slice(0, 13)}…` : full;
  return String(rounded);
}
