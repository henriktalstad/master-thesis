export function resolveStateBlendAlpha(): number {
  const raw = Number(process.env.MPC_STATE_BLEND_ALPHA ?? "0.35");
  if (!Number.isFinite(raw)) return 0.35;
  return Math.min(1, Math.max(0, raw));
}

export function updateExtractState(input: {
  measuredC: number | null;
  predictedC: number | null;
  previousC: number;
  blendAlpha: number;
}): number {
  const { measuredC, predictedC, previousC, blendAlpha } = input;
  if (predictedC == null && measuredC == null) return previousC;
  if (predictedC == null) return measuredC!;
  if (measuredC == null) return predictedC;
  return blendAlpha * measuredC + (1 - blendAlpha) * predictedC;
}
