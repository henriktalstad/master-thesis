export const SD_CALIBRATION_CANONICAL_IDS = [
  "supply.setpoint",
  "supply.setpoint_calculated",
  "extract.setpoint",
  "supply.fan.command",
  "exhaust.fan.command",
  "heating.valve.command",
  "cooling.valve.command",
  "extract.temp",
  "supply.temp",
] as const;

export type SdCalibrationCanonicalId =
  (typeof SD_CALIBRATION_CANONICAL_IDS)[number];
