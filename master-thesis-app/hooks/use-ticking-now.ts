"use client";

import { useSyncExternalStore } from "react";

let tickingNowSnapshotMs = 0;
const tickingNowListeners = new Map<number, Set<() => void>>();
const tickingNowIntervals = new Map<number, number>();

function getTickingNowSnapshot(): number {
  if (tickingNowSnapshotMs === 0 && typeof window !== "undefined") {
    tickingNowSnapshotMs = Date.now();
  }
  return tickingNowSnapshotMs;
}

function subscribeTickingNow(
  onStoreChange: () => void,
  intervalMs: number,
): () => void {
  if (typeof window === "undefined") return () => {};

  getTickingNowSnapshot();
  let listeners = tickingNowListeners.get(intervalMs);
  if (!listeners) {
    listeners = new Set();
    tickingNowListeners.set(intervalMs, listeners);
    const id = window.setInterval(() => {
      const next = Date.now();
      if (next === tickingNowSnapshotMs) return;
      tickingNowSnapshotMs = next;
      listeners?.forEach((listener) => listener());
    }, intervalMs);
    tickingNowIntervals.set(intervalMs, id);
  }

  listeners.add(onStoreChange);
  return () => {
    listeners?.delete(onStoreChange);
    if (listeners?.size === 0) {
      const id = tickingNowIntervals.get(intervalMs);
      if (id != null) window.clearInterval(id);
      tickingNowIntervals.delete(intervalMs);
      tickingNowListeners.delete(intervalMs);
    }
  };
}

/** Klokke som kun oppdateres etter hydrering — unngår SSR/klient-mismatch. */
export function useHydratedNow(intervalMs = 30_000): Date | null {
  const nowMs = useSyncExternalStore(
    (onStoreChange) => subscribeTickingNow(onStoreChange, intervalMs),
    getTickingNowSnapshot,
    () => 0,
  );
  return nowMs === 0 ? null : new Date(nowMs);
}

/** @alias useHydratedNow */
export const useTickingNow = useHydratedNow;
