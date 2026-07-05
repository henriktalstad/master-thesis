import type { ControlLoadHourPoint } from "./control-types";

export function detectLoadProfileDataGap(
  loadProfile: readonly ControlLoadHourPoint[],
): { trailingZeroHours: number; message: string } | null {
  if (loadProfile.length < 4) return null;

  let trailingZeroHours = 0;
  for (let i = loadProfile.length - 1; i >= 0; i -= 1) {
    if ((loadProfile[i]!.actualKw ?? 0) > 0.05) break;
    trailingZeroHours += 1;
  }

  const hadEarlierLoad = loadProfile.some((p) => (p.actualKw ?? 0) > 0.5);
  if (!hadEarlierLoad || trailingZeroHours < 6) return null;

  return {
    trailingZeroHours,
    message: `Ingen energidata siste ${trailingZeroHours} timer — hull i grafen. Sjekk BHCC-synk.`,
  };
}

/** Erstatter avsluttende null-serie med null (ikke 0) for korrekt graf. */
export function applyLoadProfileTrailingGapNulls(
  loadProfile: readonly ControlLoadHourPoint[],
): ControlLoadHourPoint[] {
  const gap = detectLoadProfileDataGap(loadProfile);
  if (!gap) return [...loadProfile];

  const cutoff = loadProfile.length - gap.trailingZeroHours;
  return loadProfile.map((point, index) => {
    if (index < cutoff) return point;
    return {
      ...point,
      actualKw: null,
      simulatedKw: point.simulatedKw != null ? null : point.simulatedKw,
    };
  });
}
