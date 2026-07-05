import { describe, expect, it } from "bun:test";
import { resolveOutdoorTempForStep } from "@/lib/sd-anlegg/control/resolve-outdoor-temp";

describe("resolveOutdoorTempForStep", () => {
  it("bruker Frost når begge finnes", () => {
    const r = resolveOutdoorTempForStep({ frostC: 12.34, bmsC: 13.1 });
    expect(r.outdoorTempC).toBe(12.3);
    expect(r.outdoorTempFrostC).toBe(12.3);
    expect(r.outdoorTempBmsC).toBe(13.1);
    expect(r.source).toBe("frost");
  });

  it("faller tilbake til BMS når Frost mangler", () => {
    const r = resolveOutdoorTempForStep({ frostC: null, bmsC: 8.76 });
    expect(r.outdoorTempC).toBe(8.8);
    expect(r.outdoorTempFrostC).toBeNull();
    expect(r.outdoorTempBmsC).toBe(8.8);
    expect(r.source).toBe("bms");
  });

  it("returnerer null når begge mangler", () => {
    const r = resolveOutdoorTempForStep({ frostC: null, bmsC: null });
    expect(r.outdoorTempC).toBeNull();
    expect(r.source).toBeNull();
  });
});
