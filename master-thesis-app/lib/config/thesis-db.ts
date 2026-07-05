/**
 * Godkjent Neon-database for master-thesis-app.
 * Avviser alle andre DATABASE_URL/DIRECT_URL ved runtime og i verify-script.
 */
export const THESIS_ALLOWED_DB_HOST = "ep-fragrant-cherry-a9wk5yhe-pooler";
export const THESIS_ALLOWED_DB_NAME = "scoped-solutions";

export type ParsedDatabaseUrl = {
  host: string;
  database: string;
  label: string;
};

export function parseDatabaseUrl(
  raw: string | undefined,
  label: string,
): ParsedDatabaseUrl | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw);
    const database = url.pathname.slice(1).split("?")[0];
    return { host: url.hostname, database, label };
  } catch {
    throw new Error(`${label} er ikke en gyldig URL`);
  }
}

export function isAllowedThesisDatabase(parsed: ParsedDatabaseUrl): boolean {
  return (
    parsed.host.includes(THESIS_ALLOWED_DB_HOST) &&
    parsed.database === THESIS_ALLOWED_DB_NAME
  );
}

/** Unngår pg-connection-string SSL-advarsel (require → verify-full). */
export function normalizePgConnectionString(raw: string): string {
  try {
    const url = new URL(raw);
    const sslmode = url.searchParams.get("sslmode");
    if (
      sslmode === "require" ||
      sslmode === "prefer" ||
      sslmode === "verify-ca"
    ) {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export function getNormalizedDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
  if (!url?.trim()) {
    throw new Error("DATABASE_URL (eller DIRECT_URL) må være satt.");
  }
  return normalizePgConnectionString(url);
}

export function assertThesisDatabaseUrl(options?: {
  /** Sett true for placeholder under prisma generate uten .env */
  allowPlaceholder?: boolean;
}): void {
  const allowPlaceholder = options?.allowPlaceholder ?? false;
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  if (!databaseUrl?.trim() && !directUrl?.trim()) {
    if (allowPlaceholder) return;
    throw new Error(
      "DATABASE_URL mangler. Sett godkjent Neon-URL i .env (se .env.example).",
    );
  }

  for (const raw of [databaseUrl, directUrl]) {
    if (!raw?.trim()) continue;
    const parsed = parseDatabaseUrl(raw, raw === databaseUrl ? "DATABASE_URL" : "DIRECT_URL");
    if (!parsed) continue;

    if (
      allowPlaceholder &&
      parsed.host === "127.0.0.1" &&
      parsed.database === "placeholder"
    ) {
      continue;
    }

    if (!isAllowedThesisDatabase(parsed)) {
      throw new Error(
        `${parsed.label} peker på ugyldig database ` +
          `(host=${parsed.host}, db=${parsed.database}). ` +
          `Kun ${THESIS_ALLOWED_DB_HOST} / ${THESIS_ALLOWED_DB_NAME} er tillatt for thesis-app.`,
      );
    }
  }
}
