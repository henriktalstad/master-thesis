/** Visning av norsk mobil/telefon (8 siffer eller +47 …). */
export function formatSdAnleggContactPhoneDisplay(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  }
  if (digits.startsWith("47") && digits.length === 10) {
    return `+47 ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
  }
  if (digits.startsWith("0047") && digits.length === 12) {
    return `+47 ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
  }
  return trimmed;
}

export function formatSdAnleggContactTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 8) return `tel:+47${digits}`;
  if (digits.startsWith("47") && digits.length >= 10) return `tel:+${digits}`;
  if (digits.startsWith("0047")) return `tel:+${digits.slice(2)}`;
  return `tel:${digits || phone.replace(/[\s()-]/g, "")}`;
}
