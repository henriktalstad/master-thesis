/** PA-0805 undernummer for varme/kjøling (32/35/37). */
export type ThermalSubsystemRole = "supply_water" | "return_water";
export type VentilationSubsystemRole =
  | "intake"
  | "exhaust_outlet"
  | "bypass"
  | "supply_air"
  | "extract_air"
  | "recirculation"
  | "overflow"
  | "special_extract";

export type InfraspawnSubsystemRole =
  | ThermalSubsystemRole
  | VentilationSubsystemRole
  | null;

const THERMAL_SUBSYSTEM: Record<string, ThermalSubsystemRole> = {
  "04": "supply_water",
  "05": "return_water",
};

const VENTILATION_SUBSYSTEM: Record<string, VentilationSubsystemRole> = {
  "01": "intake",
  "02": "exhaust_outlet",
  "03": "bypass",
  "04": "supply_air",
  "05": "extract_air",
  "06": "recirculation",
  "07": "overflow",
  "08": "special_extract",
};

export function resolveSubsystemRole(
  systemCode: string,
  subsystemSuffix: string | null | undefined,
): InfraspawnSubsystemRole {
  if (!subsystemSuffix) return null;
  const key = subsystemSuffix.padStart(2, "0").slice(-2);

  if (/^32|^35|^37/.test(systemCode)) {
    return THERMAL_SUBSYSTEM[key] ?? null;
  }
  if (/^36/.test(systemCode)) {
    return VENTILATION_SUBSYSTEM[key] ?? null;
  }
  return null;
}

export function subsystemRoleLabel(role: InfraspawnSubsystemRole): string | null {
  switch (role) {
    case "supply_water":
      return "Tur";
    case "return_water":
      return "Retur";
    case "intake":
      return "Luftinntak";
    case "exhaust_outlet":
      return "Luftavkast";
    case "bypass":
      return "By-pass";
    case "supply_air":
      return "Tilluft";
    case "extract_air":
      return "Avtrekk";
    case "recirculation":
      return "Omluft";
    case "overflow":
      return "Overstrømning";
    case "special_extract":
      return "Spesialavtrekk";
    default:
      return null;
  }
}
