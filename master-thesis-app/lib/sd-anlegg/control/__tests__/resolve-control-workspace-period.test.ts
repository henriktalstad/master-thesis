import { describe, expect, test } from "bun:test";
import { resolveControlWorkspacePeriod } from "@/lib/sd-anlegg/control/resolve-control-workspace-period";
import type { ThesisEvalPeriod } from "@/lib/sd-anlegg/control/control-types";

const evalPeriod: ThesisEvalPeriod = {
  evalStart: "2025-09-01T00:00:00.000Z",
  evalEnd: "2025-11-15T12:00:00.000Z",
  stepCount: 999,
  source: "db",
};

describe("resolveControlWorkspacePeriod", () => {
  test("eval-modus bruker evalStart og evalEnd fra evalPeriod", () => {
    const now = new Date("2025-11-15T12:00:00.000Z");
    const period = resolveControlWorkspacePeriod({
      periodMode: "eval",
      evalPeriod,
      now,
    });

    expect(period.mode).toBe("eval");
    expect(period.label).toBe("Eval");
    expect(period.since.toISOString()).toBe(evalPeriod.evalStart);
    expect(period.until.toISOString()).toBe(evalPeriod.evalEnd);
    expect(period.lookbackHours).toBeGreaterThan(100);
  });

  test("live-modus bruker siste N timer fra nå", () => {
    const now = new Date("2025-11-15T12:00:00.000Z");
    const period = resolveControlWorkspacePeriod({
      periodMode: "live",
      lookbackDaysParam: "7",
      evalPeriod,
      now,
    });

    expect(period.mode).toBe("live");
    expect(period.label).toBe("7 d");
    expect(period.lookbackHours).toBe(168);
    expect(period.until.getTime()).toBe(now.getTime());
    expect(period.since.getTime()).toBe(now.getTime() - 168 * 3_600_000);
  });

  test("eval uten evalPeriod faller tilbake til live 24 t", () => {
    const now = new Date("2025-11-15T12:00:00.000Z");
    const period = resolveControlWorkspacePeriod({
      periodMode: "eval",
      evalPeriod: null,
      now,
    });

    expect(period.mode).toBe("live");
    expect(period.lookbackHours).toBe(24);
  });
});
