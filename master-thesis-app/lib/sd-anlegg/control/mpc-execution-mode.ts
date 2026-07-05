import type { MpcExecutionMode } from "@/generated/client";

export type { MpcExecutionMode };

export const MPC_CANONICAL_STEP_MINUTES = 15 as const;

/** Materialiser disse oppløsningene fra 15-min replay for rask lesing. */
export const MATERIALIZED_CONTROL_BUCKET_MINUTES = [5, 15, 60] as const;

export type MaterializedControlBucketMinutes =
  (typeof MATERIALIZED_CONTROL_BUCKET_MINUTES)[number];

export function parseMpcExecutionMode(
  value: string | undefined,
): MpcExecutionMode {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "LIVE") return "LIVE";
  if (normalized === "SUPERVISORY") return "SUPERVISORY";
  return "SHADOW";
}

export function mpcExecutionModeLabel(mode: MpcExecutionMode): string {
  switch (mode) {
    case "LIVE":
      return "Live BMS";
    case "SUPERVISORY":
      return "Operatør-godkjenning";
    default:
      return "Simulering";
  }
}

export function shouldPersistWritebackCommands(mode: MpcExecutionMode): boolean {
  return mode === "SUPERVISORY" || mode === "LIVE";
}

export function canAutoPublishToBms(mode: MpcExecutionMode): boolean {
  return mode === "LIVE";
}
