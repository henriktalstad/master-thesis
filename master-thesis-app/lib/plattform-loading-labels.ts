import type { PeriodOption } from "@/types/periods";
import { PERIOD_LABELS } from "@/types/periods";

export const LAST = {
  initialiserer: "Initialiserer …",
  eos: "Laster EOS …",
  eosNokkeltall: "Laster EOS – nøkkeltall …",
  eosDetaljertAnalyse: "Laster EOS – detaljert analyse …",
  oversikt: "Laster oversikt …",
  oversiktKpiOgAnalyse: "Laster oversikt – nøkkeltall …",
  oversiktDetaljertAnalyse: "Laster detaljert analyse …",
  oversiktEnergi: "Laster oversikt – energi …",
  oversiktProduksjon: "Laster oversikt – produksjon …",
  oversiktVann: "Laster oversikt – vann …",
  oversiktAvfall: "Laster oversikt – avfall …",
  oversiktProsjektstyring: "Laster prosjektstyring …",
  eiendom: "Laster eiendom …",
  eiendommer: "Laster eiendommer …",
  vaktmestere: "Laster vaktmestere …",
  redigerEiendom: "Laster rediger eiendom …",
  dokumenter: "Laster dokumenter …",
  dokumenterVisningBytter: "Bytter visning …",
  maalepunkter: "Laster målepunkter …",
  maalepunkt: "Laster målepunkt …",
  maalepunktForbruk: "Laster forbruk …",
  maalepunktMaleverdier: "Laster måleverdier …",
  maalepunktLeietakereBygg: "Laster leietakere for bygget …",
  plantegninger: "Laster plantegninger …",
  plantegning: "Laster plantegning …",
  energiattester: "Laster energiattester …",
  energiattest: "Laster energiattest …",
  integrasjoner: "Laster integrasjoner …",
  elhub: "Laster Elhub …",
  smartvatten: "Laster Smartvatten …",
  enoco: "Laster Enoco …",
  fenistra: "Laster Fenistra …",
  fenistraFordeling: "Laster Fenistra fordeling …",
  fazile: "Laster Fazile …",
  infraspawn: "Laster Infraspawn …",
  henteplan: "Laster Henteplan …",
  sdAnlegg: "Laster SD-anlegg …",
  sdAnleggStyring: "Laster styring …",
  fazileFordeling: "Laster Fazile fordeling …",
  integrasjonOppsett: "Laster integrasjonsoppsett …",
  portefolje: "Laster portefølje …",
  portefoljer: "Laster porteføljer …",
  tiltak: "Laster tiltak …",
  tiltakPortefolje: "Laster porteføljeanalyse …",
  tiltakForBygg: "Laster tiltak for bygg …",
  crremAnalyse: "Laster CRREM-analyse …",
  bygningskropp: "Laster bygningskropp …",
  varme: "Laster varme …",
  varmepumpe: "Laster varmepumpe …",
  ventilasjon: "Laster ventilasjon …",
  energiomlegging: "Laster energiomlegging …",
  drift: "Laster drift …",
  driftFane: "Laster drift-fane …",
  admin: "Laster admin …",
  adminMeny: "Laster adminmeny …",
  eiendomsverdi: "Laster eiendomsverdi …",
  romdekning: "Laster romdekning …",
  varslinger: "Laster varslinger …",
  kontroll: "Laster kontroll …",
  kontrollMeters: "Laster målerfunn …",
  tilbakemelding: "Laster tilbakemelding …",
  leietakerfordeling: "Laster leietakerfordeling …",
  byggLeietakere: "Laster leietakere og kontrakter …",
  leggTilEiendom: "Laster veiviser …",
  leggTilEnheter: "Laster enheter …",
  arealplaner: "Laster arealplaner …",
  leietaker: "Laster leietaker …",
  leietakere: "Laster leietakere …",
  leietakerRapport: "Laster leietaker-rapport …",
  leietakerFane: "Laster leietakerfane …",
  fordelingsnokler: "Laster fordelingsnøkler …",
  byggandel: "Laster byggandel …",
  malepunktandel: "Laster målepunktandel …",
  fordelingsmetode: "Laster fordelingsmetode …",
  interaktivPlantegning: "Laster interaktiv plantegning …",
  interaktiveLeietakersoner: "Laster leietakersoner …",
  interaktiveMalersoner: "Laster målersoner …",
  gjennomgang: "Laster gjennomgang …",
  interaktivFordelingNokler: "Laster fordeling …",
  profil: "Laster profil …",
  brukere: "Laster brukere …",
  organisasjon: "Laster organisasjon …",
  innstillinger: "Laster innstillinger …",
  kart: "Laster kart …",
  innhold: "Laster innhold …",
  prosjektMaal: "Laster mål …",
  prosjektOversikt: "Laster prosjektoversikt …",
  prosjektMaaldetalj: "Laster måldetaljer …",
  prosjektDetalj: "Laster prosjekt …",
  prosjektMaalOppgaver: "Laster oppgaver …",
  prosjektMaalProsjekter: "Laster prosjekter …",
  prosjektMaalFremdrift: "Laster fremdrift …",
} as const;

export function portfolioLoadingLabel(portfolioName?: string | null): string {
  const trimmed = portfolioName?.trim();
  return trimmed ? `Laster ${trimmed} …` : LAST.portefolje;
}

export function dashboardPeriodLoadingLabel(period: PeriodOption): string {
  return `Laster ${PERIOD_LABELS[period]} …`;
}

export function dashboardCustomComparisonLoadingLabel(): string {
  return "Laster tilpasset periode …";
}

export function dashboardBuildingLoadingLabel(): string {
  return "Laster bygning …";
}

export function dashboardPortfolioLoadingLabel(): string {
  return "Laster portefølje …";
}
