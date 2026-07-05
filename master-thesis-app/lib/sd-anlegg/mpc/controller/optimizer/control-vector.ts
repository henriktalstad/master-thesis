import type { MpcControlBounds, MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";
import { MPC_CONTROL_KEYS } from "@/lib/sd-anlegg/mpc/shared/types";

export function zeroControlVector(): MpcControlVector {
  return {
    supplySetpointC: 0,
    supplyFanPct: 0,
    exhaustFanPct: 0,
    heatingValvePct: 0,
    coolingValvePct: 0,
    districtTr002ValvePct: 0,
    districtTr003ValvePct: 0,
  };
}

export function controlVector(partial: Partial<MpcControlVector> = {}): MpcControlVector {
  return { ...zeroControlVector(), ...partial };
}

export function addControlVectors(
  a: MpcControlVector,
  b: MpcControlVector,
): MpcControlVector {
  return {
    supplySetpointC: a.supplySetpointC + b.supplySetpointC,
    supplyFanPct: a.supplyFanPct + b.supplyFanPct,
    exhaustFanPct: a.exhaustFanPct + b.exhaustFanPct,
    heatingValvePct: a.heatingValvePct + b.heatingValvePct,
    coolingValvePct: a.coolingValvePct + b.coolingValvePct,
    districtTr002ValvePct: a.districtTr002ValvePct + b.districtTr002ValvePct,
    districtTr003ValvePct: a.districtTr003ValvePct + b.districtTr003ValvePct,
  };
}

export function deltaControlVectors(
  u: MpcControlVector,
  reference: MpcControlVector,
): MpcControlVector {
  return {
    supplySetpointC: u.supplySetpointC - reference.supplySetpointC,
    supplyFanPct: u.supplyFanPct - reference.supplyFanPct,
    exhaustFanPct: u.exhaustFanPct - reference.exhaustFanPct,
    heatingValvePct: u.heatingValvePct - reference.heatingValvePct,
    coolingValvePct: u.coolingValvePct - reference.coolingValvePct,
    districtTr002ValvePct: u.districtTr002ValvePct - reference.districtTr002ValvePct,
    districtTr003ValvePct: u.districtTr003ValvePct - reference.districtTr003ValvePct,
  };
}

export function clampControlVector(
  u: MpcControlVector,
  bounds: MpcControlBounds,
): MpcControlVector {
  const out = { ...u };
  for (const key of MPC_CONTROL_KEYS) {
    out[key] = Math.min(bounds.max[key], Math.max(bounds.min[key], out[key]));
  }
  return out;
}

export function clampDeltaU(
  delta: MpcControlVector,
  bounds: MpcControlBounds,
): MpcControlVector {
  const out = { ...delta };
  for (const key of MPC_CONTROL_KEYS) {
    out[key] = Math.min(
      bounds.maxDeltaPerStep[key],
      Math.max(-bounds.maxDeltaPerStep[key], out[key]),
    );
  }
  return out;
}

export function controlVectorNormSq(v: MpcControlVector): number {
  return MPC_CONTROL_KEYS.reduce((acc, key) => acc + v[key] ** 2, 0);
}

export function heatingActiveFromVector(u: MpcControlVector): boolean {
  return (
    u.heatingValvePct > 8 ||
    u.districtTr002ValvePct > 8 ||
    u.districtTr003ValvePct > 8
  );
}

export function coolingActiveFromVector(u: MpcControlVector): boolean {
  return u.coolingValvePct > 8;
}

export function mergeControlVector(
  base: Partial<MpcControlVector>,
  fallback: MpcControlVector,
): MpcControlVector {
  return {
    supplySetpointC: base.supplySetpointC ?? fallback.supplySetpointC,
    supplyFanPct: base.supplyFanPct ?? fallback.supplyFanPct,
    exhaustFanPct: base.exhaustFanPct ?? fallback.exhaustFanPct,
    heatingValvePct: base.heatingValvePct ?? fallback.heatingValvePct,
    coolingValvePct: base.coolingValvePct ?? fallback.coolingValvePct,
    districtTr002ValvePct: base.districtTr002ValvePct ?? fallback.districtTr002ValvePct,
    districtTr003ValvePct: base.districtTr003ValvePct ?? fallback.districtTr003ValvePct,
  };
}
