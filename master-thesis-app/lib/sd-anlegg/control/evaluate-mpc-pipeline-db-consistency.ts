import { buildReplayProposedCommands } from "@/lib/sd-anlegg/control/command-sink";
import type { CapacityTariffAnalysis } from "./build-capacity-tariff-analysis";
import { buildPriceLoadShiftAnalysis } from "./build-price-load-shift-analysis";
import type { PriceLoadShiftAnalysis } from "./build-price-load-shift-analysis";
import {
  buildMpcReplayVerification,
  type MpcReplaySummaryVerificationSlice,
  type MpcReplayVerification,
} from "./build-mpc-replay-verification";
import {
  buildScopeBuildingEnergyCompare,
  type ScopeBuildingEnergyCompare,
} from "./build-scope-building-energy-compare";
import type { MpcEnergyReconcileSummary } from "./build-mpc-energy-reconcile";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import {
  verifyReplayRunScalars,
  type PersistedRunScalars,
  type ReplayScalarVerification,
} from "./verify-replay-run-scalars";
import { proxyShareLooksInflated } from "./build-mpc-energy-reconcile";
import { hourlyPeakKwFromTr003Measured } from "./hourly-peak-from-replay-steps";
import {
  countReplayStepsOutsideEvalWindow,
  filterReplayStepsToEvalWindow,
} from "./replay-eval-window";

export type MpcPipelineDbCheckStatus = "pass" | "warn" | "fail";

export type MpcPipelineDbCheck = {
  id: string;
  status: MpcPipelineDbCheckStatus;
  message: string;
  expected?: number | string | null;
  actual?: number | string | null;
};

export type MpcPipelineRelationalArtifacts = {
  policyKpiCount: number;
  priceLoadBandCount: number;
  chartPointCount: number;
  chartsGeneratedAt: Date | null;
};

export type MpcPipelineDbAudit = {
  generatedAt: string;
  pipelineRunId: string;
  buildingId: string;
  evalStart: string;
  evalEnd: string;
  health: MpcPipelineDbCheckStatus;
  checks: MpcPipelineDbCheck[];
  counts: {
    stepCountDeclared: number;
    replayStepRows: number;
    supervisoryCommands: number;
    supervisoryCommandsExpected: number;
    energyReconcileHours: number;
    bhccHours: number;
    bhccHoursExpected: number;
  };
  verification: MpcReplayVerification;
  scalarVerification: ReplayScalarVerification | null;
  scopeCompare: ScopeBuildingEnergyCompare | null;
  capacityTariff: CapacityTariffAnalysis | null;
};

function check(
  id: string,
  status: MpcPipelineDbCheckStatus,
  message: string,
  expected?: number | string | null,
  actual?: number | string | null,
): MpcPipelineDbCheck {
  return { id, status, message, expected, actual };
}

function mergeHealth(checks: readonly MpcPipelineDbCheck[]): MpcPipelineDbCheckStatus {
  if (checks.some((c) => c.status === "fail")) return "fail";
  if (checks.some((c) => c.status === "warn")) return "warn";
  return "pass";
}

function near(a: number, b: number, eps = 0.05): boolean {
  return Math.abs(a - b) <= eps;
}

export function evaluateMpcPipelineDbConsistency(input: {
  pipelineRunId: string;
  buildingId: string;
  evalStart: Date;
  evalEnd: Date;
  stepCount: number;
  measuredElectricityKwh?: number | null;
  energyReconcileSummary: MpcEnergyReconcileSummary | null;
  replaySummary: MpcReplaySummaryVerificationSlice | null;
  replayStepRows: number;
  supervisoryCommands: number;
  energyReconcileHours: number;
  bhccHours: number;
  steps: readonly MpcReplayStep[];
  capacityTariff?: CapacityTariffAnalysis | null;
  energyReconcile?: MpcEnergyReconcileSummary | null;
  priceLoadShift?: PriceLoadShiftAnalysis | null;
  relationalArtifacts?: MpcPipelineRelationalArtifacts;
  persistedRunScalars?: PersistedRunScalars | null;
}): MpcPipelineDbAudit {
  const checks: MpcPipelineDbCheck[] = [];
  const expectedCommands = buildReplayProposedCommands({
    buildingId: input.buildingId,
    pipelineRunId: input.pipelineRunId,
    steps: input.steps,
  }).length;

  const reconcile =
    input.energyReconcileSummary ?? input.energyReconcile ?? null;
  const hoursAligned = reconcile?.hoursAligned ?? 0;
  const rel = input.relationalArtifacts;

  const evalSteps = filterReplayStepsToEvalWindow(
    input.steps,
    input.evalStart,
    input.evalEnd,
  );
  const outOfWindow = countReplayStepsOutsideEvalWindow(
    input.steps,
    input.evalStart,
    input.evalEnd,
  );

  if (input.replayStepRows !== input.stepCount) {
    checks.push(
      check(
        "replay_step_rows",
        "fail",
        "Normaliserte replay-rader matcher ikke stepCount",
        input.stepCount,
        input.replayStepRows,
      ),
    );
  } else {
    checks.push(
      check(
        "replay_step_rows",
        "pass",
        "Normaliserte replay-rader matcher stepCount",
        input.stepCount,
        input.replayStepRows,
      ),
    );
  }

  if (rel) {
    if (rel.policyKpiCount === 0) {
      checks.push(
        check("policy_kpis", "warn", "Mangler normaliserte policy-KPI-rader"),
      );
    } else {
      checks.push(
        check(
          "policy_kpis",
          "pass",
          "Policy-KPI-rader persistert",
          ">0",
          rel.policyKpiCount,
        ),
      );
    }
    if (rel.priceLoadBandCount === 0) {
      checks.push(
        check(
          "price_load_bands",
          "warn",
          "Mangler priceLoadShiftBands i DB",
        ),
      );
    } else {
      checks.push(
        check(
          "price_load_bands",
          "pass",
          "Pris/last-bånd persistert",
          ">0",
          rel.priceLoadBandCount,
        ),
      );
    }
    if (!rel.chartsGeneratedAt || rel.chartPointCount === 0) {
      checks.push(
        check(
          "chart_points",
          "warn",
          "Mangler normaliserte chartPoints / chartsGeneratedAt",
        ),
      );
    } else {
      checks.push(
        check(
          "chart_points",
          "pass",
          "ChartPoints persistert",
          ">0",
          rel.chartPointCount,
        ),
      );
    }
  } else {
    checks.push(
      check(
        "relational_artifacts",
        "fail",
        "Mangler relational artifacts (policy/chart/bands)",
      ),
    );
  }

  if (outOfWindow > 0) {
    checks.push(
      check(
        "eval_window_extra_steps",
        "warn",
        "Replay-rader utenfor eval-vindu (ignorert i beregning)",
        0,
        outOfWindow,
      ),
    );
  }
  if (evalSteps.length > 0) {
    checks.push(
      check("eval_window", "pass", "Replay-steg filtrert til eval-vindu"),
    );
  } else if (input.steps.length > 0) {
    checks.push(
      check(
        "eval_window",
        "fail",
        "Ingen replay-steg innen eval-vindu",
        input.stepCount,
        0,
      ),
    );
  }

  const recomputedPriceLoad = evalSteps.length
    ? buildPriceLoadShiftAnalysis(evalSteps)
    : null;
  const persistedPriceLoad = input.priceLoadShift;

  if (!persistedPriceLoad && (rel?.priceLoadBandCount ?? 0) === 0) {
    checks.push(
      check(
        "price_load_cached",
        "warn",
        "Pris/last-analyse mangler i DB",
      ),
    );
  } else if (
    recomputedPriceLoad &&
    persistedPriceLoad &&
    !near(
      persistedPriceLoad.deltaE_hp_kwh,
      recomputedPriceLoad.deltaE_hp_kwh,
      0.2,
    )
  ) {
    checks.push(
      check(
        "price_load_match",
        "fail",
        "Persistert pris/last avviker fra recompute",
        recomputedPriceLoad.deltaE_hp_kwh,
        persistedPriceLoad.deltaE_hp_kwh,
      ),
    );
  } else if (persistedPriceLoad) {
    checks.push(
      check(
        "price_load_match",
        "pass",
        "Persistert pris/last matcher recompute",
      ),
    );
  }

  if (input.energyReconcileHours === 0) {
    checks.push(
      check(
        "energy_reconcile_hours",
        "fail",
        "Ingen energi-reconcile timer persistert",
        hoursAligned > 0 ? hoursAligned : null,
        0,
      ),
    );
  } else if (hoursAligned > 0 && input.energyReconcileHours !== hoursAligned) {
    checks.push(
      check(
        "energy_reconcile_hours",
        "warn",
        "Antall reconcile-timer avviker fra summary.hoursAligned",
        hoursAligned,
        input.energyReconcileHours,
      ),
    );
  } else {
    checks.push(
      check(
        "energy_reconcile_hours",
        "pass",
        "Energi-reconcile timer persistert",
        hoursAligned || input.energyReconcileHours,
        input.energyReconcileHours,
      ),
    );
  }

  const hasMeasuredScalars = input.measuredElectricityKwh != null;
  if (!hasMeasuredScalars && input.energyReconcileHours > 0) {
    checks.push(
      check(
        "energy_reconcile_summary",
        "warn",
        "Energi-reconcile timer finnes, men målt KPI mangler på run-raden",
      ),
    );
  } else if (hasMeasuredScalars) {
    checks.push(
      check(
        "energy_reconcile_summary",
        "pass",
        "Målt energi-KPI persistert på run-raden",
      ),
    );
  } else if (!reconcile) {
    checks.push(
      check(
        "energy_reconcile_summary",
        "fail",
        "Ingen energi-reconcile KPI på run",
      ),
    );
  }

  if (input.supervisoryCommands !== expectedCommands) {
    checks.push(
      check(
        "supervisory_commands",
        "fail",
        "Supervisory commands (replay_step) matcher ikke forventet antall",
        expectedCommands,
        input.supervisoryCommands,
      ),
    );
  } else {
    checks.push(
      check(
        "supervisory_commands",
        "pass",
        "Supervisory commands (replay_step) persistert",
        expectedCommands,
        input.supervisoryCommands,
      ),
    );
  }

  if (input.bhccHours === 0) {
    checks.push(
      check(
        "bhcc_coverage",
        "fail",
        "Ingen BHCC-timer i eval-vinduet — kjør sync-building-hourly-costs",
        hoursAligned > 0 ? hoursAligned : ">0",
        0,
      ),
    );
  } else if (hoursAligned > 0 && input.bhccHours < hoursAligned * 0.85) {
    checks.push(
      check(
        "bhcc_coverage",
        "warn",
        "BHCC-dekning under 85 % av reconcile-vindu",
        hoursAligned,
        input.bhccHours,
      ),
    );
  } else {
    checks.push(
      check(
        "bhcc_coverage",
        "pass",
        "BHCC dekker eval-vinduet",
        hoursAligned || input.bhccHours,
        input.bhccHours,
      ),
    );
  }

  const verification = buildMpcReplayVerification({
    steps: evalSteps,
    evalStart: input.evalStart.toISOString(),
    evalEnd: input.evalEnd.toISOString(),
    priceLoadShift: recomputedPriceLoad,
    capacityTariff: input.capacityTariff ?? null,
    replaySummary: input.replaySummary,
  });

  let scalarVerification: ReplayScalarVerification | null = null;
  if (input.persistedRunScalars && input.steps.length > 0) {
    scalarVerification = verifyReplayRunScalars({
      steps: input.steps,
      persisted: input.persistedRunScalars,
    });
    if (scalarVerification.ok) {
      checks.push(
        check(
          "run_scalars_e2e",
          "pass",
          "Run-scalars matcher recompute fra lagrede replay-steg",
        ),
      );
    } else {
      checks.push(
        check(
          "run_scalars_e2e",
          "fail",
          `Run-scalars avviker fra recompute (${scalarVerification.failures.length} felt)`,
          0,
          scalarVerification.failures.length,
        ),
      );
      for (const failure of scalarVerification.failures.slice(0, 5)) {
        checks.push(check("run_scalars_field", "fail", failure));
      }
      if (scalarVerification.failures.length > 5) {
        checks.push(
          check(
            "run_scalars_field",
            "fail",
            `… og ${scalarVerification.failures.length - 5} flere felt`,
          ),
        );
      }
    }
  } else if (evalSteps.length > 0) {
    checks.push(
      check(
        "run_scalars_e2e",
        "warn",
        "Mangler persisterte run-scalars for end-to-end verifikasjon",
      ),
    );
  }

  if (verification.peakFields.needsRerun) {
    checks.push(
      check(
        "peak_fields",
        "fail",
        "LoadProfile mangler peak*Kw i persisterte steg",
      ),
    );
  } else {
    checks.push(
      check("peak_fields", "pass", "Effekttopp-felter OK i replay"),
    );
  }

  const scopeCompare = buildScopeBuildingEnergyCompare({
    reconcile,
    capacityTariff: input.capacityTariff ?? null,
    replaySteps: evalSteps,
  });
  const elRow = scopeCompare?.rows.find((r) => r.id === "el");
  const heatRow = scopeCompare?.rows.find((r) => r.id === "heat");
  if (!scopeCompare) {
    checks.push(
      check(
        "scope_vs_building",
        "warn",
        "Scope vs bygg — ingen sammenligningsdata",
      ),
    );
  } else {
    if (elRow?.buildingKwh == null || elRow.buildingPeakKw == null) {
      checks.push(
        check(
          "scope_el",
          "warn",
          "Elektrisitet — mangler byggreferanse (BHCC)",
        ),
      );
    } else {
      checks.push(
        check(
          "scope_el",
          "pass",
          "Elektrisitet scope vs bygg tilgjengelig",
        ),
      );
    }
    if (heatRow?.buildingKwh == null) {
      checks.push(
        check(
          "scope_heat_kwh",
          "warn",
          "Fjernvarme — mangler bygg kWh",
        ),
      );
    } else {
      checks.push(
        check(
          "scope_heat_kwh",
          "pass",
          "Fjernvarme scope vs bygg kWh tilgjengelig",
        ),
      );
    }
    if (heatRow?.scopePeakKw == null) {
      checks.push(
        check(
          "scope_heat_peak",
          "warn",
          "Fjernvarme scope-topp mangler (krever proxyHeat i replay-steg)",
        ),
      );
    } else {
      checks.push(
        check(
          "scope_heat_peak",
          "pass",
          "Fjernvarme scope-topp beregnet",
        ),
      );
      if (
        heatRow?.scopePeakKw != null &&
        heatRow.buildingPeakKw != null
      ) {
        const tr003MeasuredPeak = hourlyPeakKwFromTr003Measured(evalSteps);
        const refPeak = tr003MeasuredPeak ?? heatRow.buildingPeakKw;
        const refLabel = tr003MeasuredPeak != null ? "TR003 målt" : "BHCC";
        if (heatRow.scopePeakKw > refPeak * 1.05) {
          checks.push(
            check(
              "scope_heat_peak_vs_building",
              "warn",
              `FV scope-topp høyere enn ${refLabel} time-topp — sjekk proxy-kalibrering`,
              refPeak,
              heatRow.scopePeakKw,
            ),
          );
        }
      }
    }
    if (
      elRow?.scopeKwh != null &&
      elRow.buildingKwh != null &&
      proxyShareLooksInflated(elRow.scopeKwh, elRow.buildingKwh, 35)
    ) {
      checks.push(
        check(
          "scope_el_share_high",
          "warn",
          "Proxy-el er høy andel av bygg — sjekk kalibrering (betaFan/flow)",
          elRow.buildingKwh,
          elRow.scopeKwh,
        ),
      );
    }
    if (
      heatRow?.scopeKwh != null &&
      heatRow.buildingKwh != null &&
      proxyShareLooksInflated(heatRow.scopeKwh, heatRow.buildingKwh, 95)
    ) {
      const heatRef =
        reconcile?.circuitMeter?.tr003EnergyKwh != null &&
        reconcile.circuitMeter.tr003EnergyKwh > 0
          ? "TR003-krets"
          : "BHCC";
      checks.push(
        check(
          "scope_heat_share_high",
          "warn",
          `Proxy-varme er høy andel av ${heatRef} — sjekk TR003-kalibrering`,
          heatRow.buildingKwh,
          heatRow.scopeKwh,
        ),
      );
    }
  }

  for (const w of verification.warnings) {
    checks.push(check("verification_warn", "warn", w));
  }
  for (const f of verification.failures) {
    checks.push(check("verification_fail", "fail", f));
  }

  return {
    generatedAt: new Date().toISOString(),
    pipelineRunId: input.pipelineRunId,
    buildingId: input.buildingId,
    evalStart: input.evalStart.toISOString(),
    evalEnd: input.evalEnd.toISOString(),
    health: mergeHealth(checks),
    checks,
    counts: {
      stepCountDeclared: input.stepCount,
      replayStepRows: input.replayStepRows,
      supervisoryCommands: input.supervisoryCommands,
      supervisoryCommandsExpected: expectedCommands,
      energyReconcileHours: input.energyReconcileHours,
      bhccHours: input.bhccHours,
      bhccHoursExpected: hoursAligned,
    },
    verification,
    scalarVerification,
    scopeCompare,
    capacityTariff: input.capacityTariff ?? null,
  };
}
