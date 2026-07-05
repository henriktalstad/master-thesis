import { describe, expect, it } from "bun:test";
import { replayStepsFromJsonBlob } from "@/lib/sd-anlegg/control/replay-steps-json";

describe("replayStepsFromJsonBlob", () => {
  const steps = [
    { t: "2026-01-01T00:00:00.000Z" },
    { t: "2026-01-01T00:15:00.000Z" },
    { t: "2026-01-01T00:30:00.000Z" },
  ] as never[];

  it("returnerer tom liste for null/undefined", () => {
    expect(replayStepsFromJsonBlob(null)).toEqual([]);
    expect(replayStepsFromJsonBlob(undefined)).toEqual([]);
  });

  it("returnerer alle steg uten maxSteps", () => {
    expect(replayStepsFromJsonBlob(steps)).toHaveLength(3);
  });

  it("returnerer siste N steg med maxSteps", () => {
    const tail = replayStepsFromJsonBlob(steps, 2);
    expect(tail).toHaveLength(2);
    expect(tail[0]?.t).toBe("2026-01-01T00:15:00.000Z");
  });
});
