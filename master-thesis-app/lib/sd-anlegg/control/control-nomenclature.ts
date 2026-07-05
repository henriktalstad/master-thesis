import type { PolicyId } from "@/lib/sd-anlegg/mpc/controller/policies/types";
import type { MpcTuningPresetId } from "@/lib/sd-anlegg/mpc/config/mpc-tuning-presets";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";

export type ControlModeId =
  | "measured"
  | "predicted_baseline"
  | "price_responsive_rules"
  | "horizon_coupled_mpc";

export type PolicyClaimDisplay = "Measured" | "Predicted" | "Simulated";

export type PolicyNomenclature = {
  policyId: PolicyId;
  shortLabel: string;
  thesisLabel: string;
  thesisLabelEn: string;
  claimDisplay: PolicyClaimDisplay;
  controlMode: ControlModeId;
  controlModeLabel: string;
  description: string;
  role: "reference" | "comparator" | "proposed";
};

export type TuningPresetNomenclature = {
  presetId: MpcTuningPresetId;
  shortLabel: string;
  thesisLabel: string;
  role:
    | "stress_test"
    | "baseline"
    | "legacy_default"
    | "comfort_balanced"
    | "cost_focus"
    | "anlegg_default";
  description: string;
};

export const MPC_ALGORITHM_NOMENCLATURE = {
  modelVersion: "mpc-v1.1-building",
  shortLabel: "Bygg-MPC v1.1",
  thesisLabel: "Coupled bygg-MPC (horisont + plant)",
  description:
    "Receding-horizon δu-MPC over AHU og fjernvarmeventiler med koblet plant-emulator.",
} as const;

export const POLICY_NOMENCLATURE: Record<PolicyId, PolicyNomenclature> = {
  observed: {
    policyId: "observed",
    shortLabel: "Målt",
    thesisLabel: "Målt BMS",
    thesisLabelEn: "Measured",
    claimDisplay: "Measured",
    controlMode: "measured",
    controlModeLabel: "Målt drift",
    description: "Målt pådrag fra SD.",
    role: "reference",
  },
  emulated: {
    policyId: "emulated",
    shortLabel: "Forventet",
    thesisLabel: "Forventet BMS",
    thesisLabelEn: "Expected",
    claimDisplay: "Predicted",
    controlMode: "predicted_baseline",
    controlModeLabel: "Forventet drift",
    description: "Forventet drift fra modell.",
    role: "reference",
  },
  "demand-scoped": {
    policyId: "demand-scoped",
    shortLabel: "Prisregler",
    thesisLabel: "Prisregler",
    thesisLabelEn: "Price rules",
    claimDisplay: "Simulated",
    controlMode: "price_responsive_rules",
    controlModeLabel: "Pris og vær",
    description: "Timevise pris-/værjusteringer.",
    role: "comparator",
  },
  "mpc-v1": {
    policyId: "mpc-v1",
    shortLabel: "MPC",
    thesisLabel: "MPC",
    thesisLabelEn: "MPC",
    claimDisplay: "Simulated",
    controlMode: "horizon_coupled_mpc",
    controlModeLabel: "Horisont-MPC",
    description:
      "Foreslått modellprediktiv styring av ventilasjon og fjernvarmeventiler.",
    role: "proposed",
  },
};

export const CANONICAL_POLICY_DISPLAY: Record<
  PolicyId,
  { no: string; en: string; claim: PolicyClaimDisplay }
> = {
  observed: { no: "Målt", en: "Measured", claim: "Measured" },
  emulated: { no: "Forventet", en: "Expected", claim: "Predicted" },
  "demand-scoped": { no: "Prisregler", en: "Price rules", claim: "Simulated" },
  "mpc-v1": { no: "MPC", en: "MPC", claim: "Simulated" },
};

export const REPLAY_POLICY_IDS_ORDERED: PolicyId[] = [
  "observed",
  "emulated",
  "demand-scoped",
  "mpc-v1",
];

export const TUNING_PRESET_ID_ALIASES: Record<string, MpcTuningPresetId> = {
  demand_optimal: "anlegg_pris_respons_v1",
};

export const TUNING_PRESET_NOMENCLATURE: Record<
  MpcTuningPresetId,
  TuningPresetNomenclature
> = {
  comfort_guarded: {
    presetId: "comfort_guarded",
    shortLabel: "Komfort-guarded",
    thesisLabel: "Komfort-guarded (stresstest)",
    role: "stress_test",
    description: "Høy λ_comfort — tester robusthet når komfort veier tyngst.",
  },
  baseline_v1: {
    presetId: "baseline_v1",
    shortLabel: "Baseline v1",
    thesisLabel: "Baseline v1 (referanse)",
    role: "baseline",
    description: "Mellom λ_comfort/move etter første E2E-runde.",
  },
  tuned_v2: {
    presetId: "tuned_v2",
    shortLabel: "Tuned v2",
    thesisLabel: "Tuned v2 (legacy hovedresultat)",
    role: "legacy_default",
    description:
      "Historisk kanonisk preset — balanse pris/komfort uten temporal move.",
  },
  tuned_v3: {
    presetId: "tuned_v3",
    shortLabel: "Anlegg komfort-balansert v1",
    thesisLabel: "Anlegg komfort-balansert v1",
    role: "comfort_balanced",
    description:
      "Koblet plant + temporal move — konservativ komfort vs pris-respons.",
  },
  cost_focused: {
    presetId: "cost_focused",
    shortLabel: "Kost-fokusert",
    thesisLabel: "Kost-fokusert (sensitivitet)",
    role: "cost_focus",
    description: "Lav λ_comfort, høy λ_peak — tester kostprioritet vs komfort.",
  },
  anlegg_pris_respons_v1: {
    presetId: "anlegg_pris_respons_v1",
    shortLabel: "Anlegg pris-respons v1",
    thesisLabel: "Anlegg pris-respons v1 (anbefalt)",
    role: "anlegg_default",
    description:
      "Standard thesis-replay — lavere bevegelsesstraff, pris-skalert horisont, total anleggstyring i scope.",
  },
};

export const PLANT_CONTROL_ACTUATORS: ReadonlyArray<{
  key: keyof MpcControlVector;
  label: string;
  scope: "ventilation" | "district_heating";
}> = [
  { key: "supplySetpointC", label: "Tilluft settpunkt", scope: "ventilation" },
  { key: "supplyFanPct", label: "Tilluftvifte", scope: "ventilation" },
  { key: "exhaustFanPct", label: "Avtrekkvifte", scope: "ventilation" },
  { key: "heatingValvePct", label: "Varmebatteri", scope: "ventilation" },
  { key: "coolingValvePct", label: "Kjølebatteri", scope: "ventilation" },
  {
    key: "districtTr002ValvePct",
    label: "TR002 ventil",
    scope: "district_heating",
  },
  {
    key: "districtTr003ValvePct",
    label: "TR003 ventil",
    scope: "district_heating",
  },
];

export const ANLEGG_CONTROL_COMPARISON_TAGLINE =
  "Målt · Forventet · Prisregler · MPC";

export const ANLEGG_CONTROL_COMPARISON_TAGLINE_EN =
  "Measured · Expected · Price rules · MPC";

export function normalizeTuningPresetId(raw: string): MpcTuningPresetId | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const aliased = TUNING_PRESET_ID_ALIASES[trimmed] ?? trimmed;
  if (aliased in TUNING_PRESET_NOMENCLATURE) {
    return aliased as MpcTuningPresetId;
  }
  return null;
}

export function policyNomenclature(policyId: PolicyId): PolicyNomenclature {
  return POLICY_NOMENCLATURE[policyId];
}

export function tuningPresetNomenclature(
  presetId: MpcTuningPresetId,
): TuningPresetNomenclature {
  return TUNING_PRESET_NOMENCLATURE[presetId];
}

export function tuningPresetDisplayLabel(presetId: MpcTuningPresetId): string {
  return TUNING_PRESET_NOMENCLATURE[presetId].shortLabel;
}
