import { describe, expect, it } from "vitest";
import { resolveInfraspawnSourceSyncIssues } from "@/lib/infraspawn/resolve-source-sync-issues";

describe("resolveInfraspawnSourceSyncIssues", () => {
  it("returnerer kilder med lastError", () => {
    const issues = resolveInfraspawnSourceSyncIssues([
      {
        id: "s1",
        label: "360.102",
        syncStatus: "IDLE",
        lastError: "Influx timeout",
        lastSuccessfulSyncAt: "2026-06-20T10:00:00.000Z",
      },
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.lastError).toBe("Influx timeout");
  });

  it("returnerer kilder med ERROR syncStatus", () => {
    const issues = resolveInfraspawnSourceSyncIssues([
      {
        id: "s1",
        label: "360.102",
        syncStatus: "ERROR",
        lastSuccessfulSyncAt: null,
      },
    ]);

    expect(issues).toHaveLength(1);
  });

  it("ignorerer friske kilder", () => {
    const issues = resolveInfraspawnSourceSyncIssues([
      {
        id: "s1",
        label: "360.102",
        syncStatus: "IDLE",
        lastError: null,
        lastSuccessfulSyncAt: "2026-06-20T10:00:00.000Z",
      },
    ]);

    expect(issues).toHaveLength(0);
  });
});
