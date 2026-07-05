/** Formaterer små kontrollerbare kost-proxies (typisk < 10 kr/time) uten å runde til 0. */
export function formatProxyKr(value: number): string {
  const abs = Math.abs(value);
  const digits = abs > 0 && abs < 10 ? 2 : 0;
  return `${value.toLocaleString("nb-NO", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} kr`;
}
