/** Visningslinje for tilkoblede Infraspawn-kilder (anleggsnavn) i SD-anlegg. */
export function formatSdAnleggAnleggsnavnLine(
  sources: ReadonlyArray<{ label: string }>,
): string | null {
  const labels = sources
    .map((source) => source.label.trim())
    .filter(Boolean);
  if (labels.length === 0) return null;
  return labels.join(" · ");
}
