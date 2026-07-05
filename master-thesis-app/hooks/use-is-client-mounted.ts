"use client";

import { useSyncExternalStore } from "react";

function subscribeNoop() {
  return () => {};
}

/** True etter hydrering. */
export function useIsClientMounted(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}
