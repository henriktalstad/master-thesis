export { assessMpcStepValidity, shouldUseFallback } from "@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity";

export function comfortViolation(
  temp: number,
  band: { min: number; max: number },
): number {
  if (temp < band.min) return band.min - temp;
  if (temp > band.max) return temp - band.max;
  return 0;
}
