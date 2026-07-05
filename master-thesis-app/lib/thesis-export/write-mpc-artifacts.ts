import { getThesisEvalPeriodEndLabel } from "@/lib/config/thesis-eval";
import { THESIS_CASE_BUILDING_SLUG } from "@/lib/config/thesis-case";
import type { AnleggControlComparison } from "@/lib/sd-anlegg/control/build-anlegg-control-comparison";
import { ANLEGG_CONTROL_COMPARISON_TAGLINE } from "@/lib/sd-anlegg/control/control-nomenclature";
import type { MpcPipelineSnapshot } from "@/lib/sd-anlegg/control/control-types";
import type { PriceLoadShiftAnalysis } from "@/lib/sd-anlegg/control/build-price-load-shift-analysis";
import {
  stepControllableKwhEmulated,
  stepControllableKwhMpc,
} from "@/lib/sd-anlegg/control/build-price-load-shift-analysis";
import type { MpcEnergyReconcileSummary } from "@/lib/sd-anlegg/control/build-mpc-energy-reconcile";
import { buildHourPriceBandsFromSteps } from "@/lib/sd-anlegg/mpc/forecasts/price-thresholds";
import { controlHourKeyFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import type { PowerProxyParams } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { comfortViolation } from "@/lib/sd-anlegg/mpc/config/mpc-comfort";
import { buildOccupancyEvalSummary } from "@/lib/sd-anlegg/mpc/config/build-occupancy-eval-summary";
import {
  NAERBYEN_OFFICE_OPERATING_PROFILE,
  resolveOccupancyForStep,
  type OccupancyCalibration,
} from "@/lib/sd-anlegg/mpc/config/resolve-occupancy";
import { parseMpcStepKey } from "@/lib/sd-anlegg/mpc/shared/time-grid";

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function observedProxyComfortViolation(step: MpcReplayStep): boolean {
  if (step.extractTempMeasC == null) return false;
  const band = {
    min: step.comfortBandMinC ?? 18,
    max: step.comfortBandMaxC ?? 24,
  };
  return comfortViolation(step.extractTempMeasC, band) > 0;
}

function vectorField(
  vector: MpcReplayStep["uMpc"] | null | undefined,
  field: keyof MpcReplayStep["uMpc"],
): number | null {
  const value = vector?.[field];
  return value != null && Number.isFinite(value) ? value : null;
}

export function buildMpcCounterfactualCsv(
  steps: readonly MpcReplayStep[],
  occupancyCalibration?: OccupancyCalibration | null,
): string {
  const hourBands = buildHourPriceBandsFromSteps(steps);

  const header = [
    "t",
    "u_meas_supply_setpoint_c",
    "u_meas_supply_setpoint_operator_c",
    "u_meas_supply_setpoint_calc_c",
    "u_meas_supply_fan_pct",
    "u_meas_exhaust_fan_pct",
    "u_meas_heating_valve_pct",
    "u_meas_cooling_valve_pct",
    "u_meas_cooling_valve_command_pct",
    "u_meas_cooling_valve_feedback_pct",
    "u_meas_district_tr002_valve_pct",
    "u_meas_district_tr003_valve_pct",
    "u_bms_sim_supply_setpoint_c",
    "u_bms_sim_supply_fan_pct",
    "u_bms_sim_exhaust_fan_pct",
    "u_bms_sim_heating_valve_pct",
    "u_bms_sim_cooling_valve_pct",
    "u_bms_sim_district_tr002_valve_pct",
    "u_bms_sim_district_tr003_valve_pct",
    "u_mpc_supply_setpoint_c",
    "u_mpc_supply_fan_pct",
    "u_mpc_exhaust_fan_pct",
    "u_mpc_heating_valve_pct",
    "u_mpc_cooling_valve_pct",
    "u_mpc_district_tr002_valve_pct",
    "u_mpc_district_tr003_valve_pct",
    "u_demand_supply_setpoint_c",
    "u_demand_supply_fan_pct",
    "u_demand_exhaust_fan_pct",
    "u_demand_heating_valve_pct",
    "u_demand_cooling_valve_pct",
    "u_demand_district_tr002_valve_pct",
    "u_demand_district_tr003_valve_pct",
    "extract_temp_meas_c",
    "extract_temp_pred_c",
    "extract_temp_pred_observed_c",
    "extract_temp_pred_emulated_c",
    "extract_temp_pred_demand_c",
    "outdoor_temp_c",
    "outdoor_temp_frost_c",
    "outdoor_temp_bms_c",
    "electric_kw",
    "heat_kw",
    "proxy_el_kwh_emulated",
    "proxy_heat_kwh_emulated",
    "proxy_el_kwh_mpc",
    "proxy_heat_kwh_mpc",
    "controllable_kwh_emulated",
    "controllable_kwh_mpc",
    "price_band",
    "marginal_kr_per_kwh",
    "spot_kr_per_kwh",
    "cost_observed_kr",
    "cost_emulated_kr",
    "cost_mpc_kr",
    "cost_demand_kr",
    "comfort_violation",
    "comfort_violation_emulated",
    "comfort_violation_demand",
    "comfort_violation_observed_proxy",
    "occupancy_q",
    "occupancy_source",
    "used_fallback",
    "fallback_reason",
  ].join(",");

  const rows = steps.map((step) => {
    const { hourLocal } = parseMpcStepKey(step.t);
    const occupancy =
      step.occupancyQ != null
        ? { q: step.occupancyQ, source: step.occupancySource ?? "historical" }
        : resolveOccupancyForStep(
            { t: step.t, hourLocal, uMeas: step.uBmsMeas },
            NAERBYEN_OFFICE_OPERATING_PROFILE,
            occupancyCalibration,
          );
    return [
      step.t,
      vectorField(step.uBmsMeas, "supplySetpointC"),
      step.supplySetpointOperatorC ?? "",
      step.supplySetpointCalcC ?? "",
      vectorField(step.uBmsMeas, "supplyFanPct"),
      vectorField(step.uBmsMeas, "exhaustFanPct"),
      vectorField(step.uBmsMeas, "heatingValvePct"),
      vectorField(step.uBmsMeas, "coolingValvePct"),
      step.coolingValveCommandPct ?? "",
      step.coolingValveFeedbackPct ?? "",
      vectorField(step.uBmsMeas, "districtTr002ValvePct"),
      vectorField(step.uBmsMeas, "districtTr003ValvePct"),
      vectorField(step.uBmsSim, "supplySetpointC"),
      vectorField(step.uBmsSim, "supplyFanPct"),
      vectorField(step.uBmsSim, "exhaustFanPct"),
      vectorField(step.uBmsSim, "heatingValvePct"),
      vectorField(step.uBmsSim, "coolingValvePct"),
      vectorField(step.uBmsSim, "districtTr002ValvePct"),
      vectorField(step.uBmsSim, "districtTr003ValvePct"),
      vectorField(step.uMpc, "supplySetpointC"),
      vectorField(step.uMpc, "supplyFanPct"),
      vectorField(step.uMpc, "exhaustFanPct"),
      vectorField(step.uMpc, "heatingValvePct"),
      vectorField(step.uMpc, "coolingValvePct"),
      vectorField(step.uMpc, "districtTr002ValvePct"),
      vectorField(step.uMpc, "districtTr003ValvePct"),
      vectorField(step.uDemand, "supplySetpointC"),
      vectorField(step.uDemand, "supplyFanPct"),
      vectorField(step.uDemand, "exhaustFanPct"),
      vectorField(step.uDemand, "heatingValvePct"),
      vectorField(step.uDemand, "coolingValvePct"),
      vectorField(step.uDemand, "districtTr002ValvePct"),
      vectorField(step.uDemand, "districtTr003ValvePct"),
      step.extractTempMeasC,
      step.extractTempPredC,
      step.extractTempPredObservedC ?? "",
      step.extractTempPredEmulatedC ?? "",
      step.extractTempPredDemandC ?? "",
      step.outdoorTempC ?? "",
      step.outdoorTempFrostC ?? "",
      step.outdoorTempBmsC ?? "",
      step.electricKw,
      step.heatKw,
      step.proxyElKwhEmulated ?? "",
      step.proxyHeatKwhEmulated ?? "",
      step.proxyElKwhMpc ?? "",
      step.proxyHeatKwhMpc ?? "",
      stepControllableKwhEmulated(step),
      stepControllableKwhMpc(step),
      hourBands.get(controlHourKeyFromIso(step.t)) ?? "medium",
      step.marginalKrPerKwh,
      step.spotKrPerKwh ?? step.marginalKrPerKwh,
      step.costBaselineKr,
      step.costEmulatedKr ?? step.costBaselineKr,
      step.costMpcKr,
      step.costDemandKr ?? "",
      step.comfortViolation,
      step.comfortViolationEmulated ?? false,
      step.comfortViolationDemand ?? false,
      observedProxyComfortViolation(step),
      occupancy.q,
      occupancy.source,
      step.usedFallback,
      step.fallbackReason ?? "",
    ]
      .map(csvEscape)
      .join(",");
  });

  return `${header}\n${rows.join("\n")}\n`;
}

export function buildMetricsSummaryJson(input: {
  modelVersion: string;
  evalStart: string;
  evalEnd: string;
  replaySummary: MpcPipelineSnapshot["replaySummary"];
  emulatorValidation: MpcPipelineSnapshot["emulatorValidation"];
  plantValidation: MpcPipelineSnapshot["plantValidation"];
  powerProxy?: PowerProxyParams | null;
  energyReconcile?: MpcEnergyReconcileSummary | null;
  priceLoadShift?: PriceLoadShiftAnalysis | null;
  occupancyCalibration?: OccupancyCalibration | null;
  replaySteps?: readonly MpcReplayStep[];
}): string {
  const policyComparison =
    input.replaySummary.policySummaries ??
    [];
  const evalPeriodEnd = getThesisEvalPeriodEndLabel();
  const occupancyEval =
    input.replaySteps?.length
      ? buildOccupancyEvalSummary(input.replaySteps, input.occupancyCalibration)
      : null;
  return `${JSON.stringify(
    {
      modelVersion: input.modelVersion,
      evalStart: input.evalStart,
      evalEnd: input.evalEnd,
      ...(evalPeriodEnd ? { evalPeriodEnd } : {}),
      generatedAt: new Date().toISOString(),
      replaySummary: input.replaySummary,
      policyComparison,
      emulatorValidation: input.emulatorValidation,
      plantValidation: input.plantValidation,
      powerProxy: input.powerProxy ?? null,
      energyReconcile: input.energyReconcile ?? null,
      priceLoadShift: input.priceLoadShift ?? null,
      occupancyEval,
    },
    null,
    2,
  )}\n`;
}

export function buildPriceLoadAnalysisJson(
  analysis: PriceLoadShiftAnalysis,
): string {
  return `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      ...analysis,
    },
    null,
    2,
  )}\n`;
}

export function buildEnergyReconcileSummaryJson(
  summary: MpcEnergyReconcileSummary,
): string {
  return `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      ...summary,
    },
    null,
    2,
  )}\n`;
}

export function buildForwardPlanSummaryJson(input: {
  modelVersion: string;
  evalStart: string;
  evalEnd: string;
  replaySummary: MpcPipelineSnapshot["replaySummary"];
  powerProxy?: PowerProxyParams | null;
  priceLoadShift?: PriceLoadShiftAnalysis | null;
}): string {
  return `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      modelVersion: input.modelVersion,
      evalStart: input.evalStart,
      evalEnd: input.evalEnd,
      replaySummary: input.replaySummary,
      powerProxy: input.powerProxy ?? null,
      priceLoadShift: input.priceLoadShift ?? null,
    },
    null,
    2,
  )}\n`;
}

export function buildPolicyComparisonSummaryJson(input: {
  evalStart: string;
  evalEnd: string;
  policyComparison: NonNullable<
    MpcPipelineSnapshot["replaySummary"]["policySummaries"]
  >;
  tuningPresetId?: string | null;
  buildingSlug?: string;
}): string {
  return `${JSON.stringify(
    {
      evalStart: input.evalStart,
      evalEnd: input.evalEnd,
      generatedAt: new Date().toISOString(),
      buildingSlug: input.buildingSlug ?? THESIS_CASE_BUILDING_SLUG,
      tuningPresetId: input.tuningPresetId ?? null,
      comparisonTagline: ANLEGG_CONTROL_COMPARISON_TAGLINE,
      policies: input.policyComparison,
    },
    null,
    2,
  )}\n`;
}

export function buildAnleggControlComparisonJson(
  comparison: AnleggControlComparison,
): string {
  return `${JSON.stringify(comparison, null, 2)}\n`;
}
