export function isJobResultOk(result: unknown): boolean {
  if (result == null || typeof result !== "object") return true;

  const record = result as Record<string, unknown>;
  if (typeof record.success === "boolean") return record.success;
  if (typeof record.ok === "boolean") return record.ok;
  if (record.status === "deferred" || record.status === "not_implemented") {
    return false;
  }
  return true;
}

export function jobResultError(result: unknown): string | undefined {
  if (result == null || typeof result !== "object") return undefined;
  const record = result as Record<string, unknown>;
  if (typeof record.error === "string") return record.error;
  if (typeof record.message === "string") return record.message;
  return undefined;
}
