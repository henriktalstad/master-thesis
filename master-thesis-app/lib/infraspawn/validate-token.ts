export type InfraspawnTokenValidation = {
  normalized: string;
  error: string | null;
};

export function validateInfraspawnApiToken(
  raw: string,
): InfraspawnTokenValidation {
  const normalized = raw.trim();
  if (!normalized) {
    return { normalized: "", error: "API-nøkkel er påkrevd" };
  }
  if (/\s/.test(normalized)) {
    return { normalized, error: "API-nøkkel kan ikke inneholde mellomrom" };
  }
  if (normalized.length < 32) {
    return { normalized, error: "API-nøkkel ser for kort ut" };
  }
  if (!/^apiv3_[A-Za-z0-9_-]+$/.test(normalized)) {
    return {
      normalized,
      error: "Forventet token som starter med apiv3_",
    };
  }
  return { normalized, error: null };
}

export function validateInfluxDatabaseName(raw: string): {
  normalized: string;
  error: string | null;
} {
  const normalized = raw.trim();
  if (!normalized) {
    return { normalized: "", error: "Database-navn er påkrevd" };
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(normalized)) {
    return {
      normalized,
      error: "Ugyldig database-navn (bokstaver, tall, understrek)",
    };
  }
  return { normalized, error: null };
}

export function isInfraspawnTokenFormatValid(token: string): boolean {
  return validateInfraspawnApiToken(token).error === null;
}

export function isInfraspawnDatabaseValid(db: string): boolean {
  return validateInfluxDatabaseName(db).error === null;
}
