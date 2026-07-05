export const SD_COMPONENT_TYPES = [
  "ventilation.fan",
  "ventilation.damper",
  "ventilation.filter",
  "ventilation.heat_recovery",
  "sensor.temperature",
  "sensor.pressure",
  "hvac.pump",
  "hvac.valve",
  "hvac.coil",
  "binary.status",
  "generic.signal",
] as const;

export type SdComponentType = (typeof SD_COMPONENT_TYPES)[number];

export type SdComponentCategory =
  | "ventilation"
  | "heating"
  | "sensor"
  | "binary"
  | "generic";

export function sdComponentCategory(
  type: SdComponentType,
): SdComponentCategory {
  if (type.startsWith("ventilation.")) return "ventilation";
  if (type.startsWith("hvac.")) return "heating";
  if (type.startsWith("sensor.")) return "sensor";
  if (type === "binary.status") return "binary";
  return "generic";
}
