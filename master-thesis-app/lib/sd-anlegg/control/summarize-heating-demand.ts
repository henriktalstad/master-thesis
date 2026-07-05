import {
  breakdownHeatingDemandKw,
  isHeatingDemandActive,
} from "@/lib/sd-anlegg/envelope-model/power/build-proxies";
import {
  summarizeTr003MeasuredEnergy,
  type Tr003MeasuredEnergy,
} from "@/lib/sd-anlegg/envelope-model/power/district-heat-ground-truth";
import { MPC_STEP_HOURS } from "@/lib/sd-anlegg/envelope-model/power/energy-quantity";
import type {
  MpcCalibrationBundle,
  MpcControlVector,
  MpcReplayStep,
} from "@/lib/sd-anlegg/mpc/shared/types";

export type { Tr003MeasuredEnergy };

export type HeatingDemandTrackKwh = {
  batteryKwh: number;
  districtKwh: number;
  totalKwh: number;
};

export type HeatingDemandSummary = {
  tr003: Tr003MeasuredEnergy;
  activeStepPct: number;
  activeSteps: number;
  observed: HeatingDemandTrackKwh;
  emulated: HeatingDemandTrackKwh;
  mpc: HeatingDemandTrackKwh;
  demand: HeatingDemandTrackKwh;
};

function emptyTrack(): HeatingDemandTrackKwh {
  return { batteryKwh: 0, districtKwh: 0, totalKwh: 0 };
}

function addTrack(
  acc: HeatingDemandTrackKwh,
  breakdown: { batteryKwh: number; districtKwh: number; totalKwh: number },
): void {
  acc.batteryKwh += breakdown.batteryKwh;
  acc.districtKwh += breakdown.districtKwh;
  acc.totalKwh += breakdown.totalKwh;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function trackFromStepFields(step: MpcReplayStep): {
  observed: HeatingDemandTrackKwh | null;
  emulated: HeatingDemandTrackKwh | null;
  mpc: HeatingDemandTrackKwh | null;
  demand: HeatingDemandTrackKwh | null;
} {
  if (
    step.heatingBatteryKwhBaseline != null ||
    step.heatingDistrictKwhMpc != null
  ) {
    return {
      observed: {
        batteryKwh: step.heatingBatteryKwhBaseline ?? 0,
        districtKwh: step.heatingDistrictKwhBaseline ?? 0,
        totalKwh:
          (step.heatingBatteryKwhBaseline ?? 0) +
          (step.heatingDistrictKwhBaseline ?? 0),
      },
      emulated: {
        batteryKwh: step.heatingBatteryKwhEmulated ?? 0,
        districtKwh: step.heatingDistrictKwhEmulated ?? 0,
        totalKwh:
          (step.heatingBatteryKwhEmulated ?? 0) +
          (step.heatingDistrictKwhEmulated ?? 0),
      },
      mpc: {
        batteryKwh: step.heatingBatteryKwhMpc ?? 0,
        districtKwh: step.heatingDistrictKwhMpc ?? 0,
        totalKwh:
          (step.heatingBatteryKwhMpc ?? 0) + (step.heatingDistrictKwhMpc ?? 0),
      },
      demand: {
        batteryKwh: step.heatingBatteryKwhDemand ?? 0,
        districtKwh: step.heatingDistrictKwhDemand ?? 0,
        totalKwh:
          (step.heatingBatteryKwhDemand ?? 0) +
          (step.heatingDistrictKwhDemand ?? 0),
      },
    };
  }
  return { observed: null, emulated: null, mpc: null, demand: null };
}

function breakdownKwh(input: {
  u: MpcControlVector;
  outdoorTempC: number | null;
  buildingDistrictHeatingKwh: number;
  power: MpcCalibrationBundle["power"];
}): HeatingDemandTrackKwh {
  const kw = breakdownHeatingDemandKw({
    u: input.u,
    outdoorTempC: input.outdoorTempC,
    buildingDistrictHeatingKwh: input.buildingDistrictHeatingKwh,
    params: input.power,
  });
  return {
    batteryKwh: kw.batteryKw * MPC_STEP_HOURS,
    districtKwh: kw.districtKw * MPC_STEP_HOURS,
    totalKwh: kw.totalKw * MPC_STEP_HOURS,
  };
}

/** Aggreger oppvarmingsbehov fra replay-steg (persisterte felt eller on-the-fly). */
export function summarizeHeatingDemandFromSteps(input: {
  steps: readonly MpcReplayStep[];
  power: MpcCalibrationBundle["power"];
  bhccDistrictHeatingKwh?: number;
}): HeatingDemandSummary {
  const observed = emptyTrack();
  const emulated = emptyTrack();
  const mpc = emptyTrack();
  const demand = emptyTrack();
  let activeSteps = 0;

  for (const step of input.steps) {
    const stored = trackFromStepFields(step);
    if (stored.observed) {
      addTrack(observed, stored.observed);
      addTrack(emulated, stored.emulated!);
      addTrack(mpc, stored.mpc!);
      addTrack(demand, stored.demand!);
    } else {
      const common = {
        outdoorTempC: step.outdoorTempC,
        buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh ?? 0,
        power: input.power,
      };
      if (step.uBmsMeas) {
        addTrack(
          observed,
          breakdownKwh({ u: step.uBmsMeas, ...common }),
        );
      }
      addTrack(emulated, breakdownKwh({ u: step.uBmsSim, ...common }));
      addTrack(mpc, breakdownKwh({ u: step.uMpc, ...common }));
      if (step.uDemand) {
        addTrack(demand, breakdownKwh({ u: step.uDemand, ...common }));
      }
    }

    const activeU = step.uBmsMeas ?? step.uBmsSim;
    if (isHeatingDemandActive(activeU)) activeSteps += 1;
  }

  const stepCount = input.steps.length;
  const tr003 = summarizeTr003MeasuredEnergy({
    steps: input.steps,
    bhccDistrictHeatingKwh: input.bhccDistrictHeatingKwh,
  });

  return {
    tr003,
    activeStepPct:
      stepCount > 0 ? round2((activeSteps / stepCount) * 100) : 0,
    activeSteps,
    observed: {
      batteryKwh: round2(observed.batteryKwh),
      districtKwh: round2(observed.districtKwh),
      totalKwh: round2(observed.totalKwh),
    },
    emulated: {
      batteryKwh: round2(emulated.batteryKwh),
      districtKwh: round2(emulated.districtKwh),
      totalKwh: round2(emulated.totalKwh),
    },
    mpc: {
      batteryKwh: round2(mpc.batteryKwh),
      districtKwh: round2(mpc.districtKwh),
      totalKwh: round2(mpc.totalKwh),
    },
    demand: {
      batteryKwh: round2(demand.batteryKwh),
      districtKwh: round2(demand.districtKwh),
      totalKwh: round2(demand.totalKwh),
    },
  };
}
