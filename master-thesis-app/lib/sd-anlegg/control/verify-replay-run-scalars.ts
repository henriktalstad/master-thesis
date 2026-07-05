import type { MpcReplayResult, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { summarizeMpcReplaySteps } from "./summarize-mpc-replay-steps";

export type PersistedRunScalars = {
  stepCount: number;
  totalCostBaselineKr?: number | null;
  totalCostEmulatedKr?: number | null;
  totalCostMpcKr?: number | null;
  totalCostDemandKr?: number | null;
  deltaCostKr?: number | null;
  deltaCostPct?: number | null;
  deltaCostVsEmulatedKr?: number | null;
  deltaCostVsEmulatedPct?: number | null;
  peakElectricKwBaseline?: number | null;
  peakElectricKwEmulated?: number | null;
  peakElectricKwMpc?: number | null;
  controllableElectricKwhBaseline?: number | null;
  controllableElectricKwhEmulated?: number | null;
  controllableElectricKwhMpc?: number | null;
  controllableHeatKwhBaseline?: number | null;
  controllableHeatKwhEmulated?: number | null;
  controllableHeatKwhMpc?: number | null;
  comfortViolationsMpc?: number | null;
  comfortViolationsBaseline?: number | null;
  comfortViolationsEmulated?: number | null;
  comfortViolationsDemand?: number | null;
  fallbackSteps?: number | null;
};

export type ReplayScalarFieldCheck = {
  field: string;
  status: "pass" | "fail";
  persisted: number | null;
  recomputed: number | null;
  tolerance: number;
};

export type ReplayScalarVerification = {
  ok: boolean;
  recomputed: MpcReplayResult["summary"] | null;
  checks: ReplayScalarFieldCheck[];
  failures: string[];
};

const COST_EPS_KR = 0.15;
const PCT_EPS = 0.15;
const KWH_EPS = 0.2;
const KW_EPS = 0.15;
const COUNT_EPS = 0;

function near(a: number | null | undefined, b: number | null | undefined, eps: number): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= eps;
}

function compareField(
  field: string,
  persisted: number | null | undefined,
  recomputed: number | null | undefined,
  tolerance: number,
): ReplayScalarFieldCheck {
  const p = persisted ?? null;
  const r = recomputed ?? null;
  const pass = near(p, r, tolerance);
  return {
    field,
    status: pass ? "pass" : "fail",
    persisted: p,
    recomputed: r,
    tolerance,
  };
}

/** End-to-end: summer lagrede replay-steg og sammenlign med persisterte run-scalars. */
export function verifyReplayRunScalars(input: {
  steps: readonly MpcReplayStep[];
  persisted: PersistedRunScalars;
}): ReplayScalarVerification {
  const recomputed = summarizeMpcReplaySteps(input.steps);
  if (!recomputed) {
    return {
      ok: false,
      recomputed: null,
      checks: [],
      failures: ["Ingen replay-steg å aggregere"],
    };
  }

  const p = input.persisted;
  const checks: ReplayScalarFieldCheck[] = [
    compareField("stepCount", p.stepCount, recomputed.stepCount, COUNT_EPS),
    compareField(
      "totalCostBaselineKr",
      p.totalCostBaselineKr,
      recomputed.totalCostBaselineKr,
      COST_EPS_KR,
    ),
    compareField(
      "totalCostEmulatedKr",
      p.totalCostEmulatedKr,
      recomputed.totalCostEmulatedKr,
      COST_EPS_KR,
    ),
    compareField(
      "totalCostMpcKr",
      p.totalCostMpcKr,
      recomputed.totalCostMpcKr,
      COST_EPS_KR,
    ),
    compareField(
      "totalCostDemandKr",
      p.totalCostDemandKr,
      recomputed.totalCostDemandKr,
      COST_EPS_KR,
    ),
    compareField("deltaCostKr", p.deltaCostKr, recomputed.deltaCostKr, COST_EPS_KR),
    compareField("deltaCostPct", p.deltaCostPct, recomputed.deltaCostPct, PCT_EPS),
    compareField(
      "deltaCostVsEmulatedKr",
      p.deltaCostVsEmulatedKr,
      recomputed.deltaCostVsEmulatedKr,
      COST_EPS_KR,
    ),
    compareField(
      "deltaCostVsEmulatedPct",
      p.deltaCostVsEmulatedPct,
      recomputed.deltaCostVsEmulatedPct,
      PCT_EPS,
    ),
    compareField(
      "peakElectricKwBaseline",
      p.peakElectricKwBaseline,
      recomputed.peakElectricKwBaseline,
      KW_EPS,
    ),
    compareField(
      "peakElectricKwEmulated",
      p.peakElectricKwEmulated,
      recomputed.peakElectricKwEmulated,
      KW_EPS,
    ),
    compareField(
      "peakElectricKwMpc",
      p.peakElectricKwMpc,
      recomputed.peakElectricKwMpc,
      KW_EPS,
    ),
    compareField(
      "controllableElectricKwhBaseline",
      p.controllableElectricKwhBaseline,
      recomputed.controllableElectricKwhBaseline,
      KWH_EPS,
    ),
    compareField(
      "controllableElectricKwhEmulated",
      p.controllableElectricKwhEmulated,
      recomputed.controllableElectricKwhEmulated,
      KWH_EPS,
    ),
    compareField(
      "controllableElectricKwhMpc",
      p.controllableElectricKwhMpc,
      recomputed.controllableElectricKwhMpc,
      KWH_EPS,
    ),
    compareField(
      "controllableHeatKwhBaseline",
      p.controllableHeatKwhBaseline,
      recomputed.controllableHeatKwhBaseline,
      KWH_EPS,
    ),
    compareField(
      "controllableHeatKwhEmulated",
      p.controllableHeatKwhEmulated,
      recomputed.controllableHeatKwhEmulated,
      KWH_EPS,
    ),
    compareField(
      "controllableHeatKwhMpc",
      p.controllableHeatKwhMpc,
      recomputed.controllableHeatKwhMpc,
      KWH_EPS,
    ),
    compareField(
      "comfortViolationsMpc",
      p.comfortViolationsMpc,
      recomputed.comfortViolationsMpc,
      COUNT_EPS,
    ),
    compareField(
      "comfortViolationsBaseline",
      p.comfortViolationsBaseline,
      recomputed.comfortViolationsBaseline,
      COUNT_EPS,
    ),
    compareField(
      "comfortViolationsEmulated",
      p.comfortViolationsEmulated,
      recomputed.comfortViolationsEmulated,
      COUNT_EPS,
    ),
    compareField(
      "comfortViolationsDemand",
      p.comfortViolationsDemand,
      recomputed.comfortViolationsDemand,
      COUNT_EPS,
    ),
    compareField("fallbackSteps", p.fallbackSteps, recomputed.fallbackSteps, COUNT_EPS),
  ];

  const failures = checks
    .filter((c) => c.status === "fail")
    .map(
      (c) =>
        `${c.field}: DB=${c.persisted ?? "—"} vs recompute=${c.recomputed ?? "—"} (tol ±${c.tolerance})`,
    );

  return {
    ok: failures.length === 0,
    recomputed,
    checks,
    failures,
  };
}
