import { describe, expect, test } from "bun:test";
import {
  logMpcReplayProgress,
  resetMpcReplayProgressLog,
} from "../mpc-replay-progress-log";

describe("logMpcReplayProgress", () => {
  test("logger kun én gang per milepæl", () => {
    resetMpcReplayProgressLog();
    const lines: string[] = [];
    const orig = console.info;
    console.info = (...args: unknown[]) => {
      lines.push(String(args[0]));
    };
    try {
      const progress = {
        stepIndex: 0,
        totalSteps: 265,
        elapsedMs: 100,
        fallbackSteps: 0,
      };
      logMpcReplayProgress(progress);
      logMpcReplayProgress(progress);
      expect(lines).toHaveLength(1);
    } finally {
      console.info = orig;
    }
  });
});
