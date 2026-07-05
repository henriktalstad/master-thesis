const TRANSIENT_DB_ERROR =
  /Connection terminated|timeout|ECONNRESET|Unable to start a transaction|Transaction API error/i;

export function normalizeInfraspawnSyncError(message: string): string {
  if (TRANSIENT_DB_ERROR.test(message)) {
    return "Midlertidig databasefeil under sync. Prøv igjen om et øyeblikk.";
  }
  return message;
}
