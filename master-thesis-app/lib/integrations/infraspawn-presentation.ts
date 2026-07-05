/**
 * Felles brukerrettet tekst og lenker for Infraspawn i integrasjons-UI.
 * Holder kort, tabell og dropdown i synk (én kilde for «SD-anlegg»,
 * «Administrer anlegg», ikon og manage-URL). Ikke en generell provider-registry.
 */
export const INFRASPAWN_PRESENTATION = {
  datakildeLabel: "SD-anlegg",
  accessSummary: "Én nøkkel per anlegg",
  typeBadge: "SD-anlegg",
  iconSrc: "/integrasjoner/infraspawn.svg",
  manageHref: "/integrasjoner/infraspawn",
  manageLabel: "Administrer anlegg",
} as const;
