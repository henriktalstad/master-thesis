import type { MpcControlVector, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { MPC_CONTROL_KEYS } from "@/lib/sd-anlegg/mpc/shared/types";
import { deltaControlVectors } from "@/lib/sd-anlegg/mpc/controller/optimizer/control-vector";

function round1(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function round3(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 1000) / 1000;
}

/** Kompakt 15-min payload — kun tall som trengs for UI/replay-sammendrag. */
export type CompactMpcReplayPayload = {
  o: number[] | null;
  s: number[];
  m: number[];
  /** Behovsstyrt policy (demand-scoped) */
  d?: number[];
  spo?: number | null;
  spc?: number | null;
  ex: number | null;
  xp: number | null;
  /** Utetemp (foroverkobling) */
  ot?: number | null;
  /** Utetemp Frost */
  otf?: number | null;
  /** Utetemp BMS */
  otb?: number | null;
  /** Marginal kr/kWh */
  mp?: number | null;
  cb: number;
  ce: number;
  cm: number;
  /** Kostnad demand-scoped (kr) */
  cd?: number;
  el: number;
  ht: number;
  cv: 0 | 1;
  fb: 0 | 1;
};

function vectorToArray(v: MpcControlVector | null | undefined): number[] | null {
  if (!v) return null;
  return MPC_CONTROL_KEYS.map((key) => v[key]);
}

function arrayToVector(arr: number[]): MpcControlVector {
  const base = {
    supplySetpointC: arr[0] ?? 0,
    supplyFanPct: arr[1] ?? 0,
    exhaustFanPct: arr[2] ?? 0,
    heatingValvePct: arr[3] ?? 0,
    coolingValvePct: arr[4] ?? 0,
    districtTr002ValvePct: arr[5] ?? 0,
    districtTr003ValvePct: arr[6] ?? 0,
  };
  return base;
}

export function compactMpcReplayStep(step: MpcReplayStep): CompactMpcReplayPayload {
  const demandVector = step.uDemand ? vectorToArray(step.uDemand) : undefined;
  return {
    o: vectorToArray(step.uBmsMeas),
    s: vectorToArray(step.uBmsSim)!,
    m: vectorToArray(step.uMpc)!,
    ...(demandVector ? { d: demandVector } : {}),
    spo: step.supplySetpointOperatorC ?? null,
    spc: step.supplySetpointCalcC ?? null,
    ex: round1(step.extractTempMeasC),
    xp: round1(step.extractTempPredC),
    ot: round1(step.outdoorTempC),
    otf: round1(step.outdoorTempFrostC),
    otb: round1(step.outdoorTempBmsC),
    mp: round3(step.marginalKrPerKwh),
    cb: step.costBaselineKr,
    ce: step.costEmulatedKr,
    cm: step.costMpcKr,
    ...(step.costDemandKr != null ? { cd: step.costDemandKr } : {}),
    el: step.electricKw,
    ht: step.heatKw,
    cv: step.comfortViolation ? 1 : 0,
    fb: step.usedFallback ? 1 : 0,
  };
}

export function expandCompactMpcReplayStep(
  stepAt: string,
  payload: CompactMpcReplayPayload,
): MpcReplayStep {
  const uBmsSim = arrayToVector(payload.s);
  const uMpc = arrayToVector(payload.m);
  const uDemand = payload.d ? arrayToVector(payload.d) : undefined;
  const uObserved = payload.o ? arrayToVector(payload.o) : null;
  const deltaReference = uObserved ?? uBmsSim;
  return {
    t: stepAt,
    supplySetpointOperatorC: payload.spo ?? null,
    supplySetpointCalcC: payload.spc ?? null,
    uBmsMeas: uObserved,
    uBmsSim,
    uMpc,
    ...(uDemand ? { uDemand } : {}),
    deltaU: deltaControlVectors(uMpc, deltaReference),
    extractTempMeasC: payload.ex,
    extractTempPredC: payload.xp,
    electricKw: payload.el ?? 0,
    heatKw: payload.ht ?? 0,
    marginalKrPerKwh: payload.mp ?? null,
    outdoorTempC: payload.ot ?? null,
    outdoorTempFrostC: payload.otf ?? null,
    outdoorTempBmsC: payload.otb ?? null,
    costBaselineKr: payload.cb,
    costEmulatedKr: payload.ce ?? payload.cb,
    costMpcKr: payload.cm,
    ...(payload.cd != null ? { costDemandKr: payload.cd } : {}),
    comfortViolation: payload.cv === 1,
    usedFallback: payload.fb === 1,
  };
}
