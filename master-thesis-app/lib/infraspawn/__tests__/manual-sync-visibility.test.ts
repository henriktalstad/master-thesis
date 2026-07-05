import { describe, expect, test } from "bun:test";
import {
  INFRASPAWN_MANUAL_SYNC_FRESH_THRESHOLD_MINUTES,
  infraspawnManualSyncButtonLabel,
  resolveInfraspawnManualSyncVisibility,
} from "@/lib/infraspawn/manual-sync-visibility";

const base = {
  isActive: true,
  lastSuccessfulSyncAt: null as string | null,
  lastError: null as string | null,
};

describe("resolveInfraspawnManualSyncVisibility", () => {
  const now = new Date("2026-06-19T12:00:00.000Z");

  test("skjuler for inaktiv kilde", () => {
    expect(
      resolveInfraspawnManualSyncVisibility(
        { ...base, isActive: false },
        { now, isDevelopment: false },
      ),
    ).toEqual({ show: false });
  });

  test("viser alltid i utvikling", () => {
    const result = resolveInfraspawnManualSyncVisibility(
      {
        ...base,
        lastSuccessfulSyncAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
      },
      { now, isDevelopment: true },
    );
    expect(result).toEqual({
      show: true,
      reason: "dev_environment",
      variant: "outline",
    });
  });

  test("viser ved sync-feil", () => {
    const result = resolveInfraspawnManualSyncVisibility(
      {
        ...base,
        lastError: "Tilkobling feilet",
        lastSuccessfulSyncAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
      },
      { now, isDevelopment: false },
    );
    expect(result).toEqual({
      show: true,
      reason: "sync_error",
      variant: "secondary",
    });
  });

  test("viser ved manglende vellykket sync", () => {
    expect(
      resolveInfraspawnManualSyncVisibility(
        { ...base, lastSuccessfulSyncAt: null },
        { now, isDevelopment: false },
      ),
    ).toEqual({
      show: true,
      reason: "never_synced",
      variant: "secondary",
    });
  });

  test("skjuler uten variant når sync er fersk", () => {
    const fresh = new Date(
      now.getTime() -
        (INFRASPAWN_MANUAL_SYNC_FRESH_THRESHOLD_MINUTES - 1) * 60_000,
    ).toISOString();
    expect(
      resolveInfraspawnManualSyncVisibility(
        { ...base, lastSuccessfulSyncAt: fresh },
        { now, isDevelopment: false },
      ),
    ).toEqual({ show: false });
  });

  test("viser når sync er eldre enn terskel", () => {
    const stale = new Date(
      now.getTime() -
        INFRASPAWN_MANUAL_SYNC_FRESH_THRESHOLD_MINUTES * 60_000,
    ).toISOString();
    const result = resolveInfraspawnManualSyncVisibility(
      { ...base, lastSuccessfulSyncAt: stale },
      { now, isDevelopment: false },
    );
    expect(result).toEqual({
      show: true,
      reason: "sync_stale",
      variant: "outline",
    });
  });
});

describe("infraspawnManualSyncButtonLabel", () => {
  test("tilpasser etikett etter årsak", () => {
    expect(infraspawnManualSyncButtonLabel("never_synced")).toBe("Hent data nå");
    expect(infraspawnManualSyncButtonLabel("sync_error")).toBe("Prøv igjen");
    expect(infraspawnManualSyncButtonLabel("sync_stale")).toBe("Oppdater nå");
    expect(infraspawnManualSyncButtonLabel("dev_environment")).toBe(
      "Oppdater nå",
    );
  });
});
