#!/usr/bin/env bun
/** Statiske sjekker: implementasjon vs Theory Ch. 4. Usage: bun run verify-theory-alignment */

import {
  interpolateComfortBand,
} from "@/lib/sd-anlegg/mpc/config/comfort-schedule";
import {
  NAERBYEN_OFFICE_OPERATING_PROFILE,
  UNOCCUPIED_Q_THRESHOLD,
  resolveOccupancyForStep,
} from "@/lib/sd-anlegg/mpc/config/resolve-occupancy";
import { REPLAY_POLICY_IDS, getAllControlPolicies } from "@/lib/sd-anlegg/mpc/controller/policies/registry";
import {
  CANONICAL_POLICY_DISPLAY,
  POLICY_NOMENCLATURE,
  REPLAY_POLICY_IDS_ORDERED,
} from "@/lib/sd-anlegg/control/control-nomenclature";
import { MPC_U_MEAS_CANONICALS, MPC_PLANT_OBSERVATION_CANONICALS } from "@/services/mpc/mpc-canonicals";
import { assessPlantPredictionBounded } from "@/lib/sd-anlegg/mpc/pipeline/assess-plant-prediction-error";
import { assessMpcStepValidity, shouldUseFallback } from "@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import type { PolicyId } from "@/lib/sd-anlegg/mpc/controller/policies/types";

let failed = 0;

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.info(`[theory] OK  ${name}`);
    return;
  }
  failed += 1;
  console.error(`[theory] FAIL ${name}${detail ? `: ${detail}` : ""}`);
}

assert("four replay policies (Theory §operation policy ladder)", REPLAY_POLICY_IDS.length === 4);

const policies = getAllControlPolicies();
assert(
  "claim levels: observed · predicted · simulated",
  policies.some((p) => p.claimLevel === "observed") &&
    policies.some((p) => p.claimLevel === "predicted") &&
    policies.filter((p) => p.claimLevel === "simulated").length >= 2,
);

const nomenclatureIds = Object.keys(POLICY_NOMENCLATURE) as PolicyId[];
assert(
  "POLICY_NOMENCLATURE matches replay registry",
  REPLAY_POLICY_IDS.every((id) => nomenclatureIds.includes(id)) &&
    nomenclatureIds.length === REPLAY_POLICY_IDS.length,
);

for (const id of REPLAY_POLICY_IDS_ORDERED) {
  const n = POLICY_NOMENCLATURE[id];
  const canon = CANONICAL_POLICY_DISPLAY[id];
  assert(
    `nomenclature labels ${id}`,
    n.shortLabel === canon.no &&
      n.thesisLabelEn === canon.en &&
      n.claimDisplay === canon.claim,
  );
}

const expectedRoles: Record<PolicyId, string> = {
  observed: "reference",
  emulated: "reference",
  "demand-scoped": "comparator",
  "mpc-v1": "proposed",
};
for (const id of REPLAY_POLICY_IDS) {
  assert(
    `role ${id}`,
    POLICY_NOMENCLATURE[id].role === expectedRoles[id],
  );
}

assert("u_k vector covers BMS actuators (Theory §BMS interface)", MPC_U_MEAS_CANONICALS.length >= 5);
assert(
  "comfort proxy y_k (extract) separate from u_k actuators",
  MPC_PLANT_OBSERVATION_CANONICALS.includes("extract.temp") &&
    MPC_U_MEAS_CANONICALS.includes("supply.fan.command"),
);

const missingMeasStep = {
  t: "2026-06-24T12:00:00.000Z",
  uMeas: null,
  outdoorTempC: 15,
} as MpcTimestep;
const validity = assessMpcStepValidity(missingMeasStep);
assert(
  "fallback δu=0 when u_meas missing (eq. baseline-relative)",
  !validity.canOptimize && validity.fallbackReason === "missing_u_meas",
);
assert(
  "shouldUseFallback mirrors step validity",
  shouldUseFallback(missingMeasStep),
);

const band = { min: 18, max: 24 };
const okPlant = assessPlantPredictionBounded({ rmseC: 1.2, comfortBandC: band });
const badPlant = assessPlantPredictionBounded({ rmseC: 2.0, comfortBandC: band });
assert(
  "plant bounded ≤25 % comfort band (Seel / Method)",
  okPlant?.bounded === true && badPlant?.bounded === false,
);

const saturdayNoon = resolveOccupancyForStep(
  {
    t: "2026-06-27T10:00:00.000Z",
    hourLocal: 12,
    uMeas: null,
  },
  NAERBYEN_OFFICE_OPERATING_PROFILE,
);
assert(
  "occupancy q_k low on weekend (Theory §demand signal)",
  saturdayNoon.q < UNOCCUPIED_Q_THRESHOLD && saturdayNoon.source === "schedule",
);

const occupiedBand = { min: 18, max: 24 };
const unoccupiedBand = { min: 17, max: 26 };
const weekdayBand = interpolateComfortBand(occupiedBand, unoccupiedBand, 1);
const weekendBand = interpolateComfortBand(occupiedBand, unoccupiedBand, 0);
assert(
  "comfort band widens when q_k→0",
  weekendBand.min < weekdayBand.min && weekendBand.max > weekdayBand.max,
);

if (failed > 0) {
  console.error(`[theory] ${failed} sjekk(er) feilet`);
  process.exit(1);
}

console.info("[theory] alle statiske sjekker bestått");
