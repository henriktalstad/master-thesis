import { describe, expect, test } from "bun:test";
import { resolveBhccSyncWindow } from "@/lib/energy/bhcc-sync-window";

describe("resolveBhccSyncWindow", () => {
  test("slutter ved start av i dag Oslo (t.o.m. i går)", () => {
    const ref = new Date("2026-07-02T08:00:00.000Z");
    const window = resolveBhccSyncWindow({ reference: ref });
    expect(window.throughOsloYmd).toBe("2026-07-01");
    expect(window.endExclusive.toISOString()).toBe("2026-07-01T22:00:00.000Z");
  });
});
