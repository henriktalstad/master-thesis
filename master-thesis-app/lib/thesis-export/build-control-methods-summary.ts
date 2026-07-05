/**
 * Samler policy-sammenligning, MPC-tuning og sensitivitet til én thesis-oversikt.
 */

export type ControlPolicyRow = {
  id: string;
  kind: "control_policy";
  label: string;
  claimLevel: string;
  totalCostKr: number | null;
  deltaCostVsObservedPct: number | null;
  comfortViolations: number | null;
  description: string;
};

export type MpcTuningRow = {
  id: string;
  kind: "mpc_tuning_preset";
  label: string;
  lambdaComfort: number | null;
  lambdaMove: number | null;
  lambdaPeak: number | null;
  deltaCostVsEmulatedPct: number | null;
  comfortViolationsMpc: number | null;
  meaningfulDeltaPct: number | null;
  description: string;
  recommended?: boolean;
};

export type SensitivityRow = {
  id: string;
  kind: "sensitivity_scenario";
  label: string;
  presetId: string | null;
  deltaCostPct: number | null;
  comfortViolationsMpc: number | null;
  description: string;
};

export type ControlMethodsSummary = {
  generatedAt: string;
  evalStart: string | null;
  evalEnd: string | null;
  controlPolicies: ControlPolicyRow[];
  mpcTuningPresets: MpcTuningRow[];
  sensitivityScenarios: SensitivityRow[];
  thesisGuidance: {
    policies: string;
    tuning: string;
    sensitivity: string;
    occupancy: string;
  };
};

import {
  policyNomenclature,
  POLICY_NOMENCLATURE,
  tuningPresetNomenclature,
} from "@/lib/sd-anlegg/control/control-nomenclature";

const POLICY_DESCRIPTIONS: Record<string, string> = {
  observed: policyNomenclature("observed").description,
  emulated: policyNomenclature("emulated").description,
  "demand-scoped": policyNomenclature("demand-scoped").description,
  "mpc-v1": policyNomenclature("mpc-v1").description,
};

const PRESET_DESCRIPTIONS: Record<string, string> = {
  comfort_guarded: tuningPresetNomenclature("comfort_guarded").description,
  baseline_v1: tuningPresetNomenclature("baseline_v1").description,
  tuned_v2: tuningPresetNomenclature("tuned_v2").description,
  tuned_v3: tuningPresetNomenclature("tuned_v3").description,
  cost_focused: tuningPresetNomenclature("cost_focused").description,
  anlegg_pris_respons_v1: tuningPresetNomenclature("anlegg_pris_respons_v1").description,
  demand_optimal: tuningPresetNomenclature("anlegg_pris_respons_v1").description,
};

export function buildControlMethodsSummary(input: {
  policyComparison?: {
    evalStart?: string;
    evalEnd?: string;
    policies?: Array<{
      policyId: string;
      label: string;
      claimLevel: string;
      totalCostKr?: number;
      deltaCostVsObservedPct?: number;
      comfortViolations?: number;
    }>;
  } | null;
  tuningReport?: {
    evalStart?: string;
    evalEnd?: string;
    recommendedPresetId?: string;
    results?: Array<{
      presetId: string;
      label: string;
      description?: string;
      solver?: {
        lambdaComfort?: number;
        lambdaMove?: number;
        lambdaPeak?: number;
      };
      summary?: {
        deltaCostVsEmulatedPct?: number;
        comfortViolationsMpc?: number;
      };
      meaningfulDeltaPct?: number;
    }>;
  } | null;
  sensitivityReport?: {
    evalStart?: string;
    evalEnd?: string;
    scenarios?: Array<{
      id: string;
      label: string;
      description?: string;
      presetId?: string;
      deltaCostPct?: number;
      comfortViolationsMpc?: number;
    }>;
  } | null;
}): ControlMethodsSummary {
  const evalStart =
    input.policyComparison?.evalStart ??
    input.tuningReport?.evalStart ??
    input.sensitivityReport?.evalStart ??
    null;
  const evalEnd =
    input.policyComparison?.evalEnd ??
    input.tuningReport?.evalEnd ??
    input.sensitivityReport?.evalEnd ??
    null;

  const recommended = input.tuningReport?.recommendedPresetId ?? "anlegg_pris_respons_v1";

  const controlPolicies: ControlPolicyRow[] = (
    input.policyComparison?.policies ?? []
  ).map((p) => ({
    id: p.policyId,
    kind: "control_policy" as const,
    label: p.label,
    claimLevel: p.claimLevel,
    totalCostKr: p.totalCostKr ?? null,
    deltaCostVsObservedPct: p.deltaCostVsObservedPct ?? null,
    comfortViolations: p.comfortViolations ?? null,
    description: POLICY_DESCRIPTIONS[p.policyId] ?? p.label,
  }));

  const mpcTuningPresets: MpcTuningRow[] = (
    input.tuningReport?.results ?? []
  ).map((r) => ({
    id: r.presetId,
    kind: "mpc_tuning_preset" as const,
    label: r.label,
    lambdaComfort: r.solver?.lambdaComfort ?? null,
    lambdaMove: r.solver?.lambdaMove ?? null,
    lambdaPeak: r.solver?.lambdaPeak ?? null,
    deltaCostVsEmulatedPct: r.summary?.deltaCostVsEmulatedPct ?? null,
    comfortViolationsMpc: r.summary?.comfortViolationsMpc ?? null,
    meaningfulDeltaPct: r.meaningfulDeltaPct ?? null,
    description: r.description ?? PRESET_DESCRIPTIONS[r.presetId] ?? r.label,
    recommended: r.presetId === recommended,
  }));

  const sensitivityScenarios: SensitivityRow[] = (
    input.sensitivityReport?.scenarios ?? []
  ).map((s) => ({
    id: s.id,
    kind: "sensitivity_scenario" as const,
    label: s.label,
    presetId: s.presetId ?? null,
    deltaCostPct: s.deltaCostPct ?? null,
    comfortViolationsMpc: s.comfortViolationsMpc ?? null,
    description: s.description ?? s.label,
  }));

  return {
    generatedAt: new Date().toISOString(),
    evalStart,
    evalEnd,
    controlPolicies,
    mpcTuningPresets,
    sensitivityScenarios,
    thesisGuidance: {
      policies:
        "Fire styringsprinsipper på samme 15-min grid: Målt · Forventet · Prisregler · MPC. Se også anlegg_control_comparison.json for total scope og forventet baseline.",
      tuning:
        "Samme Bygg-MPC v1.1 med ulike λ-vekter. anlegg_pris_respons_v1 er canonical thesis-replay; comfort_guarded og cost_focused viser komfort/kost-robusthet.",
      sensitivity:
        "Varierer både power-proxy-andeler og preset — viser usikkerhet i estimert besparelse (Methods tab:method_sensitivity_scenarios).",
      occupancy:
        "Beleggsproxy q_k ∈ [0,1] fra målt av-tilstand, historisk median og kontorprofil (man–fre 07–18, helg/helligdag). Styrer komfortband, kanalgating og off-state-anker — eksporteres som occupancy_q i mpc_counterfactual.csv og occupancyEval i metrics_summary.json.",
    },
  };
}

const POLICY_EN_LABELS: Record<string, { label: string; claim: string }> =
  Object.fromEntries(
    Object.entries(POLICY_NOMENCLATURE).map(([id, n]) => [
      id,
      { label: n.thesisLabelEn, claim: n.claimDisplay.toLowerCase() },
    ]),
  );

export function formatControlMethodsSummaryLatex(
  summary: ControlMethodsSummary,
): string {
  const esc = (s: string) =>
    s.replace(/\\/g, "\\textbackslash{}").replace(/[&%_$#{}]/g, "\\$&");

  const policyRows = summary.controlPolicies
    .map((p) => {
      const en = POLICY_EN_LABELS[p.id] ?? { label: p.label, claim: p.claimLevel };
      return `${esc(en.label)} & ${esc(en.claim)} & ${p.deltaCostVsObservedPct ?? "TBD"}\\,\\% & ${p.comfortViolations ?? "TBD"} \\\\`;
    })
    .join("\n");

  const tuningRows = summary.mpcTuningPresets
    .map((p) => {
      const mark = p.recommended ? "\\textbf{" : "";
      const end = p.recommended ? "}" : "";
      return `${mark}${esc(p.id)}${end} & ${p.lambdaComfort ?? "TBD"} & ${p.lambdaMove ?? "TBD"} & ${p.deltaCostVsEmulatedPct ?? "TBD"}\\,\\% & ${p.comfortViolationsMpc ?? "TBD"} \\\\`;
    })
    .join("\n");

  return `% Auto-generated — do not edit by hand
\\begin{table}[t]
\\centering
\\footnotesize
\\setlength{\\tabcolsep}{4pt}
\\caption{Control policy comparison (same eval window; harmonized comfort).}
\\label{tab:generated_policy_comparison}
\\begin{tabular}{@{}llrr@{}}
\\toprule
Policy & Claim & $\\Delta$ cost vs obs. & Comfort viol. \\\\
\\midrule
${policyRows}
\\bottomrule
\\end{tabular}
\\end{table}

\\vspace{0.75\\baselineskip}

\\begin{table}[t]
\\centering
\\footnotesize
\\setlength{\\tabcolsep}{4pt}
\\caption{MPC solver tuning presets (canonical preset uses harmonized comfort from main replay).}
\\label{tab:generated_mpc_tuning}
\\begin{tabular}{@{}lrrrr@{}}
\\toprule
Preset & $\\lambda_c$ & $\\lambda_m$ & $\\Delta$ cost vs emul. & Comfort MPC \\\\
\\midrule
${tuningRows}
\\bottomrule
\\end{tabular}
\\end{table}
`;
}
