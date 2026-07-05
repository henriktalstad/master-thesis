export const STYRING_ANALYSIS_VIEWS = [
  {
    id: "oversikt",
    label: "Oversikt",
    description: "Besparelse, sammenligning og grafer",
  },
  {
    id: "signaler",
    label: "Signaler",
    description: "Pådrag og temperatur over tid",
  },
  {
    id: "pris",
    label: "Pris & last",
    description: "Spotpris og når forbruket flyttes",
  },
  {
    id: "energi",
    label: "Energi",
    description: "Ventilasjon vs hele bygget",
  },
] as const;

export type StyringAnalysisViewId =
  (typeof STYRING_ANALYSIS_VIEWS)[number]["id"];

export const DEFAULT_STYRING_ANALYSIS_VIEW: StyringAnalysisViewId = "oversikt";

export function parseStyringAnalysisView(
  value: string | undefined,
): StyringAnalysisViewId {
  const match = STYRING_ANALYSIS_VIEWS.find((v) => v.id === value);
  return match?.id ?? DEFAULT_STYRING_ANALYSIS_VIEW;
}
