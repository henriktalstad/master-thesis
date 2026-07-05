import { describe, expect, it } from "bun:test";
import { normalizeInfraspawnSyncError } from "@/lib/infraspawn/sync-errors";

describe("normalizeInfraspawnSyncError", () => {
  it("oversetter midlertidige databasefeil til brukermelding", () => {
    expect(
      normalizeInfraspawnSyncError("Connection terminated unexpectedly"),
    ).toBe("Midlertidig databasefeil under sync. Prøv igjen om et øyeblikk.");
    expect(normalizeInfraspawnSyncError("read ECONNRESET")).toBe(
      "Midlertidig databasefeil under sync. Prøv igjen om et øyeblikk.",
    );
    expect(normalizeInfraspawnSyncError("query timeout exceeded")).toBe(
      "Midlertidig databasefeil under sync. Prøv igjen om et øyeblikk.",
    );
    expect(
      normalizeInfraspawnSyncError(
        "Transaction API error: Unable to start a transaction in the given time.",
      ),
    ).toBe("Midlertidig databasefeil under sync. Prøv igjen om et øyeblikk.");
  });

  it("beholder andre meldinger uendret", () => {
    expect(normalizeInfraspawnSyncError("Influx 401 Unauthorized")).toBe(
      "Influx 401 Unauthorized",
    );
  });
});
