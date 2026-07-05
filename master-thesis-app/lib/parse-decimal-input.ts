/** nb-NO desimalinndata: tusenskille (mellomrom), komma som desimaltegn. */

export function sanitizeDecimalInputTyping(raw: string): string {
  return raw.replace(/[^\d\s.,-]/g, "");
}

export function tryParseDecimalInput(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "," || trimmed === ".") {
    return undefined;
  }

  const normalized = trimmed
    .replace(/\s/g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function formatDecimalInputDisplay(
  value: number,
  options?: { maxDecimals?: number },
): string {
  const maxDecimals = options?.maxDecimals;
  return new Intl.NumberFormat("nb-NO", {
    maximumFractionDigits:
      typeof maxDecimals === "number" ? maxDecimals : 10,
    minimumFractionDigits: 0,
  }).format(value);
}
