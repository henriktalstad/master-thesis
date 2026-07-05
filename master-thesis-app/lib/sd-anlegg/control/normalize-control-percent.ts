/** Normaliserer BMS-pådrag i prosent (0–100). */
export type NormalizedControlPercent = {
  pct: number;
  /** Verdien ligner luftmengde (m³/h) eller annen feil skala — ikke % pådrag. */
  suspectMisMap: boolean;
};

const FLOW_LIKE_THRESHOLD = 150;

export function normalizeControlPercent(value: number): NormalizedControlPercent {
  if (!Number.isFinite(value)) {
    return { pct: 0, suspectMisMap: false };
  }
  if (value > FLOW_LIKE_THRESHOLD) {
    return { pct: 0, suspectMisMap: true };
  }
  return {
    pct: Math.min(100, Math.max(0, value)),
    suspectMisMap: false,
  };
}
