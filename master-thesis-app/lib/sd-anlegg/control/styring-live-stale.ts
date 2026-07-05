import { CONTROL_TICK_STALE_MS } from "./control-constants";

function msSince(iso: string | null, nowMs: number): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return nowMs - t;
}

/** Tick eller forward plan eldre enn terskel — trigger auto control-tick på Styring-fanen. */
export function isStyringLiveControlStale(input: {
  lastControlTickAt: string | null;
  forwardPlanComputedAt: string | null;
  nowMs?: number;
}): boolean {
  const nowMs = input.nowMs ?? Date.now();
  const tickAge = msSince(input.lastControlTickAt, nowMs);
  const planAge = msSince(input.forwardPlanComputedAt, nowMs);
  return (
    tickAge >= CONTROL_TICK_STALE_MS ||
    planAge >= CONTROL_TICK_STALE_MS ||
    input.forwardPlanComputedAt == null
  );
}
