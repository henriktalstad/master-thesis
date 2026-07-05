"use client";

import * as React from "react";

type SmoothedNumberOptions = {
  intervalMs?: number;
  maxDeltaPerTick?: number;
};

export function useSmoothedNumber(
  target: number,
  options: SmoothedNumberOptions = {},
): number {
  const intervalMs = options.intervalMs ?? 40;
  const maxDeltaPerTick = options.maxDeltaPerTick ?? 1.4;
  const [value, setValue] = React.useState(target);
  const targetRef = React.useRef(target);

  React.useEffect(() => {
    targetRef.current = target;
  }, [target]);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setValue((current) => {
        const nextTarget = targetRef.current;
        if (Math.abs(nextTarget - current) <= maxDeltaPerTick) {
          return nextTarget;
        }
        const direction = nextTarget > current ? 1 : -1;
        return current + direction * maxDeltaPerTick;
      });
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [intervalMs, maxDeltaPerTick]);

  return value;
}
