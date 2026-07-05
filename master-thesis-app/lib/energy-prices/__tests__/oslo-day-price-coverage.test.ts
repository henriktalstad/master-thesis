import { describe, expect, test } from "bun:test";
import {
  getUtcSlotsForOsloDay,
  osloYmdFromDate,
  toUTCForOslo,
} from "@/lib/utils";
import { controlHourKeyFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import { hourUtcFromPriceRow } from "@/lib/sd-anlegg/control/control-effective-price-utils";

describe("getUtcSlotsForOsloDay", () => {
  test("vanlig vinterdag har 24 UTC-slots over to kalenderdager", () => {
    const slots = getUtcSlotsForOsloDay("2026-01-15");
    expect(slots).toHaveLength(24);
    expect(slots[0]).toEqual({ date: "2026-01-14", hour: 23 });
    expect(slots[23]).toEqual({ date: "2026-01-15", hour: 22 });
  });

  test("sommerdag (CEST) starter på forrige UTC-dato kl 22", () => {
    const slots = getUtcSlotsForOsloDay("2026-07-01");
    expect(slots).toHaveLength(24);
    expect(slots[0]).toEqual({ date: "2026-06-30", hour: 22 });
    expect(slots[1]).toEqual({ date: "2026-06-30", hour: 23 });
    expect(slots[2]).toEqual({ date: "2026-07-01", hour: 0 });
    expect(slots[23]).toEqual({ date: "2026-07-01", hour: 21 });
  });

  test("Oslo time 0 og 23 mapper til kontroll-nøkler som matcher hourUtcFromPriceRow", () => {
    const slots = getUtcSlotsForOsloDay("2026-07-01");
    for (const slot of slots) {
      const iso = hourUtcFromPriceRow(
        new Date(`${slot.date}T00:00:00.000Z`),
        slot.hour,
      );
      const key = controlHourKeyFromIso(iso);
      const osloHour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Oslo",
          hour: "numeric",
          hour12: false,
        }).format(new Date(iso)),
      );
      expect(osloHour).toBeGreaterThanOrEqual(0);
      expect(osloHour).toBeLessThanOrEqual(23);
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/);
    }
  });
});

describe("toUTCForOslo ↔ osloYmdFromDate", () => {
  test("Oslo midnatt 1. juli 2026 er 30. juni 22:00 UTC", () => {
    const iso = toUTCForOslo("2026-07-01", 0);
    expect(iso).toBe("2026-06-30T22:00:00.000Z");
    expect(osloYmdFromDate(new Date(iso))).toBe("2026-07-01");
  });
});
