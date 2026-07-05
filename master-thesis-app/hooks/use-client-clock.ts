"use client";

import { useSyncExternalStore } from "react";

function subscribeNoop() {
  return () => {};
}

export type ClientClock = {
  /** True etter hydrering (useSyncExternalStore). */
  mounted: boolean;
  /** Klient-tidsstempel (ms); null på server og før hydrering. */
  nowMs: number | null;
};

let clientClockSnapshotMs = 0;
let clientClockListeners: Set<() => void> | null = null;
let clientClockInterval: number | null = null;

function getClientClockSnapshot(): number {
  if (clientClockSnapshotMs === 0 && typeof window !== "undefined") {
    clientClockSnapshotMs = Date.now();
  }
  return clientClockSnapshotMs;
}

function subscribeClientClock(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  getClientClockSnapshot();
  if (!clientClockListeners) {
    clientClockListeners = new Set();
    clientClockInterval = window.setInterval(() => {
      const next = Date.now();
      if (next === clientClockSnapshotMs) return;
      clientClockSnapshotMs = next;
      clientClockListeners?.forEach((listener) => listener());
    }, 30_000);
  }

  clientClockListeners.add(onStoreChange);
  return () => {
    clientClockListeners?.delete(onStoreChange);
    if (clientClockListeners?.size === 0) {
      window.clearInterval(clientClockInterval!);
      clientClockInterval = null;
      clientClockListeners = null;
    }
  };
}

/**
 * Én kilde for klient-tid og mount-status — unngår spredte
 * useIsClientMounted + useClientNowMs med ulik semantikk.
 */
export function useClientClock(): ClientClock {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const nowMs = useSyncExternalStore(
    subscribeClientClock,
    getClientClockSnapshot,
    () => 0,
  );
  return { mounted, nowMs: mounted ? nowMs : null };
}
