"use client";

import { useSyncExternalStore } from "react";
import { SD_ANLEGG_PROCESS_DRIFT_CLOCK } from "./styles/process-schematic-styles";

const CLOCK_FORMAT = new Intl.DateTimeFormat("nb-NO", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Oslo",
});

let processClockSnapshotMs = Date.now();

function getProcessClockSnapshot(): number {
  return processClockSnapshotMs;
}

function subscribeProcessClock(onStoreChange: () => void): () => void {
  const sync = () => {
    const next = Date.now();
    if (next === processClockSnapshotMs) return;
    processClockSnapshotMs = next;
    onStoreChange();
  };

  const id = window.setInterval(sync, 30_000);
  return () => window.clearInterval(id);
}

export function ProcessSchematicClock() {
  const nowMs = useSyncExternalStore(
    subscribeProcessClock,
    getProcessClockSnapshot,
    getProcessClockSnapshot,
  );
  const now = new Date(nowMs);

  return (
    <time dateTime={now.toISOString()} className={SD_ANLEGG_PROCESS_DRIFT_CLOCK}>
      {CLOCK_FORMAT.format(now)}
    </time>
  );
}
