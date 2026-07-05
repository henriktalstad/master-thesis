import { describe, expect, test } from "bun:test";
import {
  CONTROL_LOOKBACK_PRESETS,
  controlStyringHref,
  controlStyringHrefForExam,
  parseControlPeriodMode,
  resolveControlLookbackDays,
  resolveControlLookbackHours,
  resolveEffectiveStyringGrain,
  resolveFineGrainLoadCandidates,
  resolveFineGrainSeriesWindow,
  resolveOptimalStyringGrain,
} from "@/lib/sd-anlegg/control/resolve-control-lookback";

describe("resolve-control-lookback", () => {
  test("default periode er eval uten query", () => {
    expect(parseControlPeriodMode(undefined)).toBe("eval");
    expect(parseControlPeriodMode(undefined, "eval")).toBe("eval");
  });

  test("dager eller periode=live aktiverer live-modus", () => {
    expect(parseControlPeriodMode("7")).toBe("live");
    expect(parseControlPeriodMode(undefined, "live")).toBe("live");
  });

  test("live lookback timer fra dager-param", () => {
    expect(resolveControlLookbackHours("7")).toBe(168);
    expect(resolveControlLookbackHours(undefined)).toBe(24);
    expect(resolveControlLookbackDays(720)).toBe(30);
  });

  test("controlStyringHref uten query = eval default", () => {
    expect(controlStyringHref("bygg-a", { periodMode: "eval" })).toBe(
      "/sd-anlegg/bygg-a/styring",
    );
    expect(controlStyringHref("bygg-a", { tab: "analyse", analysisView: "signaler" })).toBe(
      "/sd-anlegg/bygg-a/styring?vis=analyse&visning=signaler",
    );
  });

  test("legacy days=1 gir live 24 t", () => {
    expect(controlStyringHref("bygg-a", 1)).toBe(
      "/sd-anlegg/bygg-a/styring?periode=live",
    );
  });

  test("controlStyringHref for live perioder", () => {
    expect(controlStyringHref("bygg-a", { periodMode: "live", days: 7 })).toBe(
      "/sd-anlegg/bygg-a/styring?periode=live&dager=7",
    );
    expect(controlStyringHref("bygg-a", { periodMode: "live", days: 1 })).toBe(
      "/sd-anlegg/bygg-a/styring?periode=live",
    );
  });

  test("controlStyringHrefForExam bevarer demo=exam og grain=15", () => {
    const href = controlStyringHrefForExam(
      "bygg-a",
      { tab: "analyse", analysisView: "signaler" },
      true,
    );
    expect(href).toContain("demo=exam");
    expect(href).toContain("grain=15");
    expect(href).toContain("vis=analyse");
    expect(href).toContain("visning=signaler");
  });

  test("presets dekker 1/7/14/30", () => {
    expect(CONTROL_LOOKBACK_PRESETS.map((p) => p.days)).toEqual([1, 7, 14, 30]);
  });

  test("resolveFineGrainSeriesWindow bruker halen av eval-vindu", () => {
    const rangeUntil = new Date("2025-11-15T12:00:00.000Z");
    const rangeSince = new Date("2025-09-01T00:00:00.000Z");
    const window = resolveFineGrainSeriesWindow({
      rangeSince,
      rangeUntil,
      effectiveHours: 24,
    });

    expect(window.until.toISOString()).toBe(rangeUntil.toISOString());
    expect(window.since.toISOString()).toBe("2025-11-14T12:00:00.000Z");
  });

  test("resolveOptimalStyringGrain — eval alltid 15 min", () => {
    expect(
      resolveOptimalStyringGrain({ periodMode: "eval", lookbackDays: 30 }),
    ).toBe("15");
  });

  test("resolveFineGrainLoadCandidates — eval bruker ikke fin SD", () => {
    expect(
      resolveFineGrainLoadCandidates({ periodMode: "eval", lookbackDays: 30 }),
    ).toEqual([]);
  });

  test("resolveFineGrainLoadCandidates — live 24 t prøver 1 og 5 min", () => {
    expect(
      resolveFineGrainLoadCandidates({ periodMode: "live", lookbackDays: 1 }),
    ).toEqual([1, 5]);
    expect(
      resolveFineGrainLoadCandidates({ periodMode: "live", lookbackDays: 7 }),
    ).toEqual([5]);
    expect(
      resolveFineGrainLoadCandidates({ periodMode: "live", lookbackDays: 30 }),
    ).toEqual([]);
  });

  test("resolveEffectiveStyringGrain — clamp ugyldig grain", () => {
    expect(
      resolveEffectiveStyringGrain({
        periodMode: "live",
        lookbackDays: 30,
        requested: "1",
      }),
    ).toBe("15");
    expect(
      resolveEffectiveStyringGrain({
        periodMode: "eval",
        lookbackDays: 7,
        requested: "1",
      }),
    ).toBe("15");
  });
});
