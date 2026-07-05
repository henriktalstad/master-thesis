import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { MpcReplayQuality } from "@/generated/client";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";

export type MpcReplayQualityLabel = "valid" | "invalid_fan";

/** Replay-run med feilkoblet vifte-% (m³/h klemte til 100) mangler realistiske 60–70 % verdier. */
export function isReplayFanSignalPlausible(
  supplyFanPctSamples: readonly number[],
): boolean {
  if (supplyFanPctSamples.length === 0) return true;
  const max = Math.max(...supplyFanPctSamples);
  if (max > 150) return false;
  const realisticBand = supplyFanPctSamples.filter(
    (v) => v > 55 && v < 75,
  ).length;
  const clamped100 = supplyFanPctSamples.filter((v) => v === 100).length;
  if (clamped100 >= 50 && realisticBand === 0) return false;
  return true;
}

export function supplyFanPctSamplesFromReplaySteps(
  steps: readonly Pick<MpcReplayStep, "uBmsMeas">[],
): number[] {
  return steps
    .map((step) => step.uBmsMeas?.supplyFanPct)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

export function assessReplayQualityFromSteps(
  steps: readonly Pick<MpcReplayStep, "uBmsMeas">[],
): {
  replayQuality: MpcReplayQualityLabel;
  maxSupplyFanPct: number | null;
} {
  const samples = supplyFanPctSamplesFromReplaySteps(steps);
  return {
    replayQuality: isReplayFanSignalPlausible(samples) ? "valid" : "invalid_fan",
    maxSupplyFanPct: samples.length > 0 ? Math.max(...samples) : null,
  };
}

/** Persistert enum for thesis/canonical run — min. ~1 uke eval (672 steg). */
export function resolvePersistedReplayQuality(input: {
  stepCount: number;
  steps: readonly Pick<MpcReplayStep, "uBmsMeas">[];
}): MpcReplayQuality {
  if (input.stepCount < 96) {
    return MpcReplayQuality.INSUFFICIENT_DATA;
  }
  const assessed = assessReplayQualityFromSteps(input.steps);
  if (assessed.replayQuality === "invalid_fan") {
    return MpcReplayQuality.INVALID_FAN;
  }
  if (input.stepCount >= 672) {
    return MpcReplayQuality.VALID;
  }
  return MpcReplayQuality.INSUFFICIENT_DATA;
}

export function resolveSignalBindingVersion(input?: {
  buildingSlug?: string | null;
}): string {
  return (
    input?.buildingSlug?.trim() ||
    resolveBuildingSlug() ||
    "unknown"
  );
}
