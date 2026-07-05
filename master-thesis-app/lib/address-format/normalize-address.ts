/** Minimal address normalizer for SD-anlegg display (thesis app). */
export function normalizeAddress(address: string | null | undefined): string {
  if (!address?.trim()) return "";
  return address
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/(?:å|a\u030A)/g, "aa")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/\s+/g, " ");
}

export function addressesMatch(
  address1: string | null | undefined,
  address2: string | null | undefined,
): boolean {
  const a = normalizeAddress(address1);
  const b = normalizeAddress(address2);
  return a.length > 0 && a === b;
}
