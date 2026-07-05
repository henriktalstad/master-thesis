import { describe, expect, test } from "bun:test";
import {
  assertThesisDatabaseUrl,
  isAllowedThesisDatabase,
  normalizePgConnectionString,
  parseDatabaseUrl,
  THESIS_ALLOWED_DB_HOST,
  THESIS_ALLOWED_DB_NAME,
} from "./thesis-db";

const OK_URL = `postgresql://user:pass@${THESIS_ALLOWED_DB_HOST}.gwc.azure.neon.tech/${THESIS_ALLOWED_DB_NAME}?sslmode=require`;

describe("thesis-db allowlist", () => {
  test("accepts approved pooler and database name", () => {
    const parsed = parseDatabaseUrl(OK_URL, "DATABASE_URL")!;
    expect(isAllowedThesisDatabase(parsed)).toBe(true);
  });

  test("rejects wrong host", () => {
    const parsed = parseDatabaseUrl(
      `postgresql://user:pass@ep-other-pooler.neon.tech/${THESIS_ALLOWED_DB_NAME}`,
      "DATABASE_URL",
    )!;
    expect(isAllowedThesisDatabase(parsed)).toBe(false);
  });

  test("rejects wrong database name", () => {
    const parsed = parseDatabaseUrl(
      `postgresql://user:pass@${THESIS_ALLOWED_DB_HOST}.neon.tech/other-db`,
      "DATABASE_URL",
    )!;
    expect(isAllowedThesisDatabase(parsed)).toBe(false);
  });

  test("assertThesisDatabaseUrl throws on wrong host", () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      "postgresql://user:pass@wrong-host.neon.tech/scoped-solutions";
    try {
      expect(() => assertThesisDatabaseUrl()).toThrow(/ugyldig database/i);
    } finally {
      process.env.DATABASE_URL = prev;
    }
  });

  test("assertThesisDatabaseUrl accepts approved url", () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = OK_URL;
    try {
      expect(() => assertThesisDatabaseUrl()).not.toThrow();
    } finally {
      process.env.DATABASE_URL = prev;
    }
  });

  test("normalizePgConnectionString upgrades sslmode=require", () => {
    const normalized = normalizePgConnectionString(
      "postgresql://u:p@host/db?sslmode=require&channel_binding=require",
    );
    expect(normalized).toContain("sslmode=verify-full");
    expect(normalized).not.toContain("sslmode=require");
  });
});
