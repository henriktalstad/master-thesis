import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";
import {
  ANLEGG_CONTROL_COMPARISON_TAGLINE,
  MPC_ALGORITHM_NOMENCLATURE,
  policyNomenclature,
} from "./control-nomenclature";
import { resolveBuildingControlProfile } from "./building-control-profile";
import { formatFallbackPctDisplay } from "./normalize-fallback-pct";

export const CONTROL_DISPLAY = {
  observed: {
    short: policyNomenclature("observed").shortLabel,
    chart: policyNomenclature("observed").shortLabel,
    description: policyNomenclature("observed").description,
  },
  predicted: {
    short: policyNomenclature("emulated").shortLabel,
    chart: policyNomenclature("emulated").shortLabel,
    description: policyNomenclature("emulated").description,
  },
  simulatedControl: {
    short: "Simulert forslag",
    chart: "Simulert forslag",
    opsShort: "Simulert forslag",
    description:
      "Optimert styring i simulering — AHU og fjernvarmeventiler.",
  },
  demand: {
    short: policyNomenclature("demand-scoped").shortLabel,
    chart: policyNomenclature("demand-scoped").shortLabel,
    description: policyNomenclature("demand-scoped").description,
  },
} as const;

export const CONTROL_TRIPLE_COMPARISON_TAGLINE = ANLEGG_CONTROL_COMPARISON_TAGLINE;

export { MPC_ALGORITHM_NOMENCLATURE };

export function controlPredictedVsSimulatedLabel(): string {
  return `${CONTROL_DISPLAY.predicted.short} vs ${CONTROL_DISPLAY.simulatedControl.short}`;
}

export function controlCostDeltaVsEmulatedLabel(): string {
  return "vs forventet";
}

export function controlCostDeltaVsObservedLabel(): string {
  return "vs målt drift";
}

export const CONTROL_VECTOR_UI_LABELS: Record<keyof MpcControlVector, string> = {
  supplySetpointC: "Tilluft SP",
  supplyFanPct: "Tilluftvifte",
  exhaustFanPct: "Avtrekkvifte",
  heatingValvePct: "Varmebatteri",
  coolingValvePct: "Kjølebatteri",
  districtTr002ValvePct: "TR002 ventil",
  districtTr003ValvePct: "TR003 ventil",
};

export const CONTROL_ESTIMATED_HINT =
  "Forventet = typisk drift fra historikk (ukedag/time) + vær og avtrekk.";

export const CONTROL_COMFORT_EXTRACT = {
  columnShort: "Avtrekk",
  columnFull: "Simulert avtrekk",
  columnHint:
    "Målt = avtrekk fra SD. Forventet, prisregler og MPC = plantmodell på strategiens pådrag + vær.",
  violationsSuffix: " brudd",
  bandLabel: "Avtrekkband",
  modelNote:
    "Plantmodellen ruller avtrekk-temp framover ut fra pådrag (SP, vifter, batterier), forrige tilstand og vær.",
  chartFocusDescription:
    "Målt = målt · simulert = plantmodell på MPC-pådrag",
} as const;

export function resolveControlScopeLabels(buildingSlug: string): {
  scopeShort: string;
  scopeLong: string;
  ahuLabel: string;
  siteLabel: string;
} {
  const profile = resolveBuildingControlProfile(buildingSlug);
  return {
    scopeShort: profile?.simulationScopeShort ?? "styresignal og energi",
    scopeLong:
      profile?.simulationScopeLong ??
      "ventilasjon, fjernvarmeventiler og byggenergi",
    ahuLabel: profile?.ahuLabel ?? "AHU",
    siteLabel: profile?.siteLabel ?? buildingSlug,
  };
}

export function controlComfortChartTitle(buildingSlug: string): string {
  const { ahuLabel } = resolveControlScopeLabels(buildingSlug);
  return `Simulert avtrekk · ${ahuLabel}`;
}

export function controlComfortChartDescription(band: {
  min: number;
  max: number;
}): string {
  return `Målt avtrekk fra SD · simulert fra plantmodell · band ${band.min}–${band.max} °C`;
}

export function controlScopeChartNote(
  buildingSlug: string,
  hourCount?: number,
): string {
  const { scopeShort } = resolveControlScopeLabels(buildingSlug);
  if (hourCount != null && hourCount > 0) {
    return `${hourCount} timer · ${scopeShort}`;
  }
  return scopeShort;
}

export function controlStrategyComparisonIntro(buildingSlug: string): string {
  const { scopeLong } = resolveControlScopeLabels(buildingSlug);
  return `Estimert kost og avtrekk for ${scopeLong} — ikke hele bygget.`;
}

export const CONTROL_KNOWN_LIMITATIONS = [
  "15-min oppløsning kan undervurdere korte effekttopper.",
  "Komfort er avtrekk-temp fra AHU — simulert ut fra pådrag, ikke romtemp i alle soner.",
  "Fjernvarmeventiler TR002/TR003 påvirker kost, men ikke avtrekk-modellen direkte.",
  "Effektledd og kjøling er delvis utenfor modellen.",
] as const;

export function controlTripleComparisonDescription(extra?: string): string {
  const base = ANLEGG_CONTROL_COMPARISON_TAGLINE;
  return extra ? `${base} · ${extra}` : base;
}

export const CONTROL_STYRING_OPS = {
  cardTitle: "Nå",
  cardDescription:
    "Skyggesimulering — AHU 360.102 og fjernvarmeventiler.",
  tableTitle: "Detalj",
  tableDescription: (signal: string, stepMinutes: 1 | 5 | 15 | 60) =>
    `${signal} · ${
      stepMinutes >= 60 ? "time" : `${stepMinutes} min`
    }`,
  emptyMessage: "Venter på SD og replay …",
  liveStripAria: "Sammenligning nå",
  liveUpdatingHint: "",
  planRefreshingHint: "Plan oppdateres …",
  noCostYet: "Kost kommer når plan er klar.",
  costSaved: (kr: string) => `−${kr} kr dette intervallet`,
  costHigher: (kr: string) => `+${kr} kr dette intervallet`,
  costNeutral: "Ingen kostforskjell dette intervallet",
  costNeutralWithDeviation: "Ingen kostforskjell dette intervallet",
  alignedWithEstimatedHint: "Simulert i tråd med forventet normal drift.",
  controlDeviationFromMeasuredHint: "Pådrag avviker fra målt drift.",
  alignedWithMeasuredHint: "I tråd med målt drift.",
  comfortBandLabel: (min: number, max: number) =>
    `Komfortband avtrekk ${min.toFixed(0)}–${max.toFixed(0)} °C`,
  showEstimatedColumnLabel: "Vis forventet",
  hideEstimatedColumnLabel: "Skjul forventet",
  loopTitle: "Over tid",
  loopDescription: "Historikk · målt · forventet · simulert",
  loopDescriptionOps:
    "Historikk for valgt periode — siste intervall vises i Nå-kortet over.",
  loopDeviationSummary: (
    count: number,
    stepMinutes: 1 | 5 | 15 | 60,
  ) => {
    const unit = stepMinutes >= 60 ? "timer" : "intervaller";
    return `${count} ${unit} der simulert forslag avviker fra målt drift.`;
  },
  loopMostlyAlignedSummary: (
    alignedCount: number,
    total: number,
    stepMinutes: 1 | 5 | 15 | 60,
  ) => {
    const unit = stepMinutes >= 60 ? "timer" : "intervaller";
    const pct = total > 0 ? Math.round((alignedCount / total) * 100) : 0;
    return `Simulert forslag ligger på målt drift i ${pct} % av ${total} ${unit} — se avvik som markerte punkter.`;
  },
  loopValveTrackingNote:
    "Varme- og kjølebatteri endres bare når batteriet er aktivt og det gir lavere estimert kost — ellers følger simulert forslag forventet/målt pådrag.",
  loopSparseDataWarning:
    "Få datapunkter i valgt periode — prøv kortere periode eller finere oppløsning.",
  loopSparseDataAction: (label: string) => `Bytt til ${label}`,
  loopTooltipDeviation: "Styring endret dette intervallet",
} as const;

export const CONTROL_STYRING_PERIOD = {
  evalPreset: "Eval",
  partialReplayPill: (loaded: number, expected: number) =>
    `${loaded.toLocaleString("nb-NO")} av ${expected.toLocaleString("nb-NO")} lastet`,
  replayCatchUpNote: (untilLabel: string) =>
    `Simulering henter opp — eval SD til ${untilLabel}`,
  analyseLiveModeNote:
    "Hovedtall gjelder eval-vindu. Live-periode brukes på Styring-fanen.",
  refreshSimulation: "Oppdater simulering",
  runSimulation: "Kjør simulering",
  simulationBadge: "Simulering",
} as const;

export const CONTROL_PIPELINE_UI = {
  stepCoverage: "Dekning",
  stepData: "SD-data",
  stepSimulation: "Simulering",
  stepResults: "Analyse",
  awaitingSimulation: "Data er klare — kjør simulering",
  awaitingSimulationDetail: (intervals: number) =>
    `${intervals.toLocaleString("nb-NO")} intervaller i perioden`,
  partialSimulation: "Delvis simulering",
  partialSimulationDetail: (loaded: number, expected: number) =>
    `${loaded.toLocaleString("nb-NO")} av ${expected.toLocaleString("nb-NO")} intervaller lagret — trykk «Oppdater simulering» for resten`,
  chartsMissing: "Grafer mangler",
  chartsMissingDetail:
    "Simuleringen er ferdig — trykk «Oppdater simulering» for analyse og grafer.",
  ready: "Klar for analyse",
  readyDetail: (intervals: number) =>
    `${intervals.toLocaleString("nb-NO")} intervaller — åpne Effekt-fanen`,
  simulationPaused: "Simulering satt på pause",
  simulationPausedDetail: (loaded: number, expected: number) =>
    `${loaded.toLocaleString("nb-NO")} av ${expected.toLocaleString("nb-NO")} intervaller lagret — kan fortsette`,
  simulationFailed: "Simulering feilet",
  simulationRunning: "Simulering pågår",
  simulationStale: "Simulering henger",
  needsSdData: "Trenger oppdatert SD-data",
  staleSamples: "Siste SD-prøver er utdaterte — synk før simulering",
  missingMeasuredControl: "Eval-vinduet mangler målt styring",
  pipelineScheduled: "Pipeline startet i bakgrunnen",
  pipelineScheduledDetail: "Henter SD-data og venter på dekning …",
  showDataSources: "Vis datakilder",
  hideDataSources: "Skjul datakilder",
} as const;

export const CONTROL_SETUP_UI = {
  preferencesTitle: "Preferanser",
  preferencesDescription: "Komfort, grenser og hva som kan optimeres.",
  preferencesIntro:
    "Settpunkter og komfort for ventilasjon. Verdier hentes fra live SD og siste simulering.",
  preferencesSavedNote: "Lagrede preferanser er aktive for dette bygget.",
  modelSectionTitle: "Modell og dekning",
  modelSectionDescription: "Er data og modell gode nok til skyggesimulering?",
  lookbackLabel: "Historikk for live-visning",
  coverageSdLabel: "SD-dekning",
  coverageSimulationLabel: "Simulering",
  coverageModelLabel: "Modell",
  coverageSeriesSub: (pct: number, days: number) =>
    `${pct} % serier · ${days} dager`,
  coverageMeasuredSub: (pct: number) => `${pct} % målt pådrag i perioden`,
  coverageWaitingCoverage: "Venter på dekning",
  coverageSimulationReady: "Klar",
  coverageSimulationBlocked: "Blokkert",
  coverageModelCalibrated: "Kalibrert",
  coverageModelWaiting: "Venter på data",
  coverageModelIntervals: (n: number) =>
    `${n.toLocaleString("nb-NO")} intervaller i siste simulering`,
  coverageModelAutoRun: "Kjører når SD-dekning er tilstrekkelig",
  modelQualityTitle: "Modellkvalitet",
  modelQualityDescription:
    "Forventet styring, kuvertmodell og kostoptimalisering — kalibrert fra siste simulering.",
  subsystemsTitle: "Signaler per delsystem",
  subsystemsDescription: (unitKey: string) =>
    `AHU ${unitKey} — kontroll, tilstand og grenser.`,
  subsystemsBadge: (n: number) => `${n} delsystemer`,
  plannedCommandsTitle: "Planlagte kommandoer",
  plannedCommandsDescription:
    "Foreslått styring lagres per 15 min — se grafer under Effekt.",
  signalCatalogTitle: "Signaler i perioden",
  signalCatalogDescription: (total: number, live: number, inSim: number) =>
    `${total} signaler · ${live} live · ${inSim} i simulering`,
  signalCatalogCoverageCol: "Dekning i simulering",
  signalCatalogBadgeSim: "Simulering",
  signalCatalogBadgeMeasure: "Måling",
  signalCatalogBadgeControl: "Styring",
  signalCatalogFagfolkTitle: "Vis detaljer for fagfolk",
  signalCatalogFagfolkDescription: "Dekning, kilder og forventede hull i SD-eksport.",
  channelSimulatedColumn: "Simulert",
  stateBlendLabel: "Tilstandsblanding",
  stateBlendHint: "Hvor mye modellen stoler på måling vs egen tilstand",
  solverParamsTitle: "Solver-parametre",
  solverParamsDescription:
    "Tekniske vekter for valgt profil — kun relevant for tuning og dokumentasjon.",
  plannedCommandsIntro:
    "Foreslått styring lagres per 15 min sammenlignet med målt SD, forventet, prisresponsiv og simulert forslag.",
  plannedCommandsEmpty: "Ingen simulering ennå — kjører når SD-dekning er tilstrekkelig.",
  plannedCommandsLastRun: "Siste kjøring",
  plannedCommandsEvalPeriod: "Evalueringsperiode",
  plannedCommandsForwardPlan: "Fremtidig plan",
  algorithmTitle: (unitKey: string) => `Slik simuleres styringen — ${unitKey}`,
  algorithmLiveOnly: "Live SD-verdier — kun visning",
} as const;

export const CONTROL_ARCHITECTURE_UI = {
  ariaLabel: "Slik data flyter i simuleringen",
  caption:
    "Simulert forslag sammenlignes med målt drift og forventet styring.",
  tabOverview: "Systemoversikt",
  tabPhysical: "AHU i drift",
  legendInput: "Prognoser",
  legendConstraint: "Grenser",
  legendMpc: "Simulering",
  legendLegacy: "Anlegg",
  legendEvaluation: "Analyse",
  showEdgeLabels: "Vis flytetiketter",
  hideEdgeLabels: "Skjul flytetiketter",
} as const;

export const CONTROL_STYRING_FORWARD = {
  title: "Plan 24 t",
  description: "",
  emptyMessage: "Plan utilgjengelig — oppdateres etter sync.",
  intro:
    "Simulert forslag for neste døgn basert på pris og vær.",
  controllableEl: "Proxy el (24 t)",
  controllableHeat: "Proxy varme (24 t)",
  costDiff: "Estimert kostforskjell",
  optimizedSteps: "Optimalisert",
  fallbackSteps: (n: number) => `${n} uten optimalisering`,
  signalsTitle: "Foreslått pådrag",
  contextTitle: "Pris og utetemperatur",
  contextDescription: "Prognose som styrer kostestimatet",
} as const;

export const CONTROL_SIGNAL_KPI = {
  mpcVsBms: "Pådrag endret",
  observedVsMpc: "Avvik mot måling",
  dataCoverage: "Datagrunnlag",
  operatorVsCalc: "Operatør vs beregnet",
  setpointSteps: "Intervaller med avvik",
} as const;

export const CONTROL_TABLE_COLUMNS = {
  diffSimulatedVsBms: "Forskjell",
  diffObservedVsSim: "Mot måling",
  diffOperatorVsCalc: "Operatør vs calc",
  costDiff: "Estimert kost",
} as const;

export const CONTROL_TABLE_SORT = {
  simulatedVsBms: "Simulert vs forventet",
  observedVsSim: "Måling vs simulert",
  time: "Tid",
} as const;

export function controlCostSummaryPlain(
  deltaVsEmulatedKr: number,
  deltaVsObservedKr?: number | null,
): string {
  const vsBms = `${deltaVsEmulatedKr > 0 ? "+" : ""}${deltaVsEmulatedKr.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr vs forventet`;
  if (
    deltaVsObservedKr != null &&
    Math.abs(deltaVsObservedKr - deltaVsEmulatedKr) > 0.01
  ) {
    const vsObs = `${deltaVsObservedKr > 0 ? "+" : ""}${deltaVsObservedKr.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr vs målt drift`;
    return `Estimert kostforskjell i perioden: ${vsBms} · ${vsObs}`;
  }
  return `Estimert kostforskjell i perioden: ${vsBms}`;
}

export const CONTROL_EXAMINER_MODE = {
  bannerTitle: "Presentasjonsmodus — live SD og skyggesimulering",
  bannerBody:
    "Målt = faktisk drift fra SD · Forventet = normal referanse · Prisregler = enkel pris/vær · Simulert = optimert forslag. Alle tall bygger på målt drift og prosjektets mpc-v1-pipeline.",
  thesisSnapshotNote:
    "PDF-tall kan være frosset til canonical eval-vindu; appen fortsetter med live SD og replay.",
  setupReadOnly: "Preferanser er skrivebeskyttet i presentasjonsmodus.",
} as const;

export const CONTROL_SHADOW_MODE = {
  heroActive: "Skyggesimulering aktiv",
  heroWaiting: "Klarer styringssammenligning",
  heroUpdating: "Oppdaterer plan …",
} as const;

export function controlShadowMpcDetailLabel(
  siteLabel: string,
  simulationScopeShort: string,
): string {
  return `Simulert forslag · ${siteLabel} · ${simulationScopeShort} · oppdateres hvert 15. min`;
}

export function controlShadowMpcDetailForBuilding(
  buildingSlug: string,
): string | null {
  const profile = resolveBuildingControlProfile(buildingSlug);
  if (!profile) return null;
  return controlShadowMpcDetailLabel(profile.siteLabel, profile.simulationScopeShort);
}

export function controlShadowContextSubline(buildingSlug: string): string {
  const profile = resolveBuildingControlProfile(buildingSlug);
  return profile?.simulationScopeShort ?? "ventilasjon, fjernvarmeventiler og energi";
}

export const CONTROL_EFFECT_UI = {
  heroChangesLabel: "Styring endret",
  heroSavingsSub: "vs målt drift",
  heroSavingsLabel: "Estimert besparelse",
  heroSavingsLabelMpc: "Estimert besparelse",
  heroExtraCostLabel: "Forskjell i merkostnad",
  heroExtraCostLabelMpc: "Forskjell i merkostnad (MPC)",
  heroSavingsDetailEmulated: "Mot forventet",
  heroSavingsDetailScope: "Utvid «Slik beregnes effekten» under for hele kjeden.",
  strategyTableTitle: "Fire måter å styre på",
  strategyColumn: "Strategi",
  costColumn: "Estimert kost",
  deltaColumn: "Forskjell vs målt",
  deltaColumnHint:
    "Prosent mot målt kost (proxy). MPC vs forventet vises som sekundærlinje der det er relevant.",
  comfortColumn: CONTROL_COMFORT_EXTRACT.columnShort,
  comfortColumnHint: CONTROL_COMFORT_EXTRACT.columnHint,
  chartCostTitle: "Kost per time",
  chartCostDescription: "Forventet vs simulert forslag",
  chartLoadTitle: "Effekt og spotpris",
  chartLoadDescriptionWithObserved: "Målt, forventet og simulert",
  chartLoadDescriptionSimulated: "Forventet og simulert",
  chartComfortViolationNote: (hours: number) =>
    hours > 0
      ? `Ca. ${hours} timer med simulert avtrekk utenfor bandet — sjekk modell og komfortinnstillinger.`
      : null,
  chartsSectionTitle: "Graf over tid",
  chartsSectionDescription:
    "Valgfritt — timevis kost, effekt og simulert avtrekk.",
  topHoursTitle: "Timer med størst forskjell",
  limitationsTitle: "Mer om tallene",
  limitationsDescription: "Datagrunnlag, begrensninger og metode",
  methodologyTitle: "Slik beregnes effekten",
  methodologyDescription:
    "Fire parallelle spor i samme 15-min perioder.",
  methodologyStepInputsTitle: "Data inn",
  methodologyStepTracksTitle: "Fire styringsspor",
  methodologyStepComputeTitle: "Estimert effekt og kost",
  methodologyStepSumTitle: "Sum over perioden",
  methodologyInputSd: "SD-måling",
  methodologyInputWeather: "Vær",
  methodologyInputPrice: "Spot og nettleie",
  methodologyInputBhcc: "Byggforbruk (BHCC)",
  methodologyComputeShort:
    "Per 15 min: effekt fra vifter og varmeventiler, ganger spot og fjernvarmepris.",
  methodologyEnergySuffix: "kWh estimert",
  methodologyHeroObserved: "Hovedtall · vs målt drift",
  methodologyHeroEmulated: "Sekundær · vs forventet drift",
  methodologyTechnicalToggle: "Vis detaljer for fagfolk",
  methodologyTechnicalFormulaLabel: "Kostformel per steg",
  methodologyTechnicalFormula:
    "kost = el_kW × Δt × spot + varme_kW × Δt × fjernvarme",
  methodologyTechnicalEl:
    "El: vifte ~ (pådrag %)³ · kalibrert β — kun styresignaler i ventilasjon.",
  methodologyTechnicalHeat: "Varme: ventiler + TR003-krets som anker.",
  methodologyScopeFootnote: (
    proxyKr: number,
    buildingKr: number,
    elSharePct: number | null,
  ) =>
    `Ventilasjon (estimert) ~ ${Math.round(proxyKr).toLocaleString("nb-NO")} kr` +
    (elSharePct != null ? ` · ${Math.round(elSharePct)} % av bygg-el` : "") +
    ` · hele bygget ${Math.round(buildingKr).toLocaleString("nb-NO")} kr målt (BHCC).`,
  partialReplayBannerTitle: "Delvis simulering lastet",
  partialReplayBannerBody: (loaded: number, expected: number) =>
    `Hovedtall gjelder hele eval-vinduet (${expected.toLocaleString("nb-NO")} intervaller). Grafer viser ${loaded.toLocaleString("nb-NO")} lastede steg — bruk «Oppdater simulering» for full dekning.`,
  partialReplayKpiNote: (loaded: number, expected: number) =>
    `Hovedtall fra full eval (${expected.toLocaleString("nb-NO")} intervaller) · ${loaded.toLocaleString("nb-NO")} steg lastet for grafer`,
  analysisNoSimulation:
    "Ingen simulering ennå. Når SD-data er klare, kjører beregningen automatisk — eller bruk «Oppdater simulering».",
  analysisNoThesisSimulation:
    "Ingen simulering tilgjengelig for evalueringsperioden.",
  analysisPriceEmpty:
    "Pris- og lastanalyse krever komplett prisdekning i perioden. Sjekk Oversikt for eval-tall.",
  analysisEnergyEmpty:
    "Energisammenligning krever byggmåling og simulering i perioden.",
  loadingViewLabel: "Laster visning …",
  fallbackWithoutOptimization: (fallbackPct: number) =>
    `${formatFallbackPctDisplay(fallbackPct)} uten optimalisering (mangler måling eller alarm)`,
} as const;

export const CONTROL_PRICE_LOAD_UI = {
  intro:
    "Om energien brukes i høy-, middels- eller lavpris — og om simulert forslag flytter last unna dyre timer.",
  loadShiftLabel: "Lastflytting",
  loadShiftSubHours: "Timer med høy pris i perioden",
  highPriceHoursLabel: "Timer med høy pris",
  peakDeltaLabel: "Effekttopp",
  highPriceCostLabel: "Kost i høypris",
  energyByBandTitle: "Energi per prisnivå",
  energyByBandDescription: "Forventet vs simulert forslag",
  capacityTariffTitle: "Effekttariff",
  capacityTariffDescription:
    "Månedlig effekttopp og estimert nettleie for ventilasjon",
  scopeCompareTitle: "Ventilasjon vs hele bygget",
  scopeCompareDescription: "Andel av strøm og fjernvarme i perioden",
  peakRerunBanner:
    "Effektdata mangler for noen timer. Kjør simulering på nytt for full effekttariff.",
  fagfolkDetails:
    "Prisnivå: daglig høy/middels/lav basert på spotpris. Effekttariff: nettleie effektledd (kr/kW·mnd) × månedlig effekttopp. Eksporteres til price_load_analysis.json.",
  scopeCompareTechnical:
    "Effekttopper er maks timeenergi (kWh/time ≈ kW). Lav el-effekt i ventilasjon ved høyere byggtopp er forventet.",
} as const;

export const CONTROL_EFFECT_STRATEGY_LINES = [
  {
    label: policyNomenclature("observed").shortLabel,
    line: "Målt pådrag og avtrekk fra SD — referanse for faktisk drift.",
    comfortLine: "Avtrekk målt i anlegget.",
  },
  {
    label: policyNomenclature("emulated").shortLabel,
    line: "Normal drift uten alarmer — referanse for dagens styring.",
    comfortLine: "Avtrekk simulert fra forventede pådrag.",
  },
  {
    label: policyNomenclature("demand-scoped").shortLabel,
    line: "Enkel regel på pris og vær.",
    comfortLine: "Avtrekk simulert fra regel-pådrag.",
  },
  {
    label: CONTROL_DISPLAY.simulatedControl.short,
    line: "Simulert forslag — optimert plan for AHU og fjernvarmeventiler.",
    comfortLine: "Avtrekk simulert fra optimert pådrag.",
  },
] as const;

export function controlMpcScopeVsBuildingLabel(
  simulationScopeLong: string,
  electricSharePct: string,
): string {
  return `MPC dekker ${simulationScopeLong} — ca. ${electricSharePct} av målt el i bygget. Lys, heiser og øvrige soner er utenfor.`;
}

export function controlMpcScopeVsBuildingForBuilding(
  buildingSlug: string,
  electricSharePct: string,
): string | null {
  const profile = resolveBuildingControlProfile(buildingSlug);
  if (!profile) return null;
  return controlMpcScopeVsBuildingLabel(profile.simulationScopeLong, electricSharePct);
}

export const CONTROL_SCOPE_SHARE_LABEL = "Ventilasjonens andel";

/** @deprecated Bruk CONTROL_SCOPE_SHARE_LABEL */
export const CONTROL_VENTILATION_SHARE_LABEL = CONTROL_SCOPE_SHARE_LABEL;

export function controlStrategyComparisonScopeNote(buildingSlug?: string): string {
  if (buildingSlug) {
    return controlStrategyComparisonIntro(buildingSlug);
  }
  return "Estimert kost for styresignaler i perioden — ikke hele bygget.";
}

export function controlStrategyComparisonScopeDetail(
  proxyObservedCostKr: number | null | undefined,
  measuredBuildingCostKr: number | null | undefined,
  stepCount?: number,
): string | null {
  if (
    proxyObservedCostKr != null &&
    measuredBuildingCostKr != null &&
    Number.isFinite(proxyObservedCostKr) &&
    Number.isFinite(measuredBuildingCostKr)
  ) {
    const proxy = Math.round(proxyObservedCostKr).toLocaleString("nb-NO");
    const building = Math.round(measuredBuildingCostKr).toLocaleString("nb-NO");
    const intervals =
      stepCount != null && stepCount > 0
        ? ` · ${stepCount.toLocaleString("nb-NO")} intervaller à 15 min`
        : "";
    return `Styresignal (proxy) ca. ${proxy} kr estimert · hele bygget ca. ${building} kr målt${intervals}.`;
  }
  return null;
}
