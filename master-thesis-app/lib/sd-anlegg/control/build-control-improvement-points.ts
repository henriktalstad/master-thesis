import { CONTROL_DISPLAY } from "./control-display-labels";
import { controlHourKeyFromIso, osloHourFromIso } from "./control-time-buckets";
import type { ControlHourlyEnergy, ControlImprovementPoint } from "./control-types";
import type { ControlSdHourlyProfile } from "./control-sd-calibration";
import type { ScenarioHourFactors } from "./scenario-hour-adjustments";

type HourRow = {
  hour: string;
  gjeldende: ControlSdHourlyProfile;
  scoped: ControlSdHourlyProfile;
  factors: ScenarioHourFactors;
  energy: ControlHourlyEnergy;
  outdoorTempC: number | null;
  effectiveMarginalKrPerKwh: number | null;
};

function avgFan(p: ControlSdHourlyProfile): number {
  return ((p.supplyFanPct ?? 0) + (p.exhaustFanPct ?? 0)) / 2;
}

function isNightOslo(hourIso: string): boolean {
  const h = osloHourFromIso(hourIso);
  return h >= 22 || h < 6;
}

export function buildControlImprovementPoints(
  rows: readonly HourRow[],
): ControlImprovementPoint[] {
  const points: ControlImprovementPoint[] = [];

  const nightHighFan = rows.filter(
    (r) =>
      isNightOslo(r.hour) &&
      avgFan(r.gjeldende) - avgFan(r.scoped) >= 5 &&
      r.factors.controlAdjusted,
  );
  if (nightHighFan.length >= 2) {
    points.push({
      id: "night_ventilation_high",
      label: "Høy ventilasjon om natten",
      detail: `Tilluft/avtrekk ligger ${Math.round(
        nightHighFan.reduce((s, r) => s + (avgFan(r.gjeldende) - avgFan(r.scoped)), 0) /
          nightHighFan.length,
      )} %-poeng over ${CONTROL_DISPLAY.demand.short.toLowerCase()} i snitt 22–06. Simulert referanse ville trimmet vifter der det er headroom.`,
      hourSpan: "22–06",
      severity: "opportunity",
      sampleHours: nightHighFan.length,
    });
  }

  const expensiveHeat = rows.filter((r) => {
    const price = r.effectiveMarginalKrPerKwh;
    const local = osloHourFromIso(r.hour);
    return (
      price != null &&
      price >= 0 &&
      local >= 6 &&
      local < 22 &&
      (r.gjeldende.heatingValvePct ?? 0) - (r.scoped.heatingValvePct ?? 0) >= 5 &&
      r.factors.controlAdjusted
    );
  });
  if (expensiveHeat.length >= 2) {
    points.push({
      id: "heating_expensive_hours",
      label: "Varmebatteri i dyre timer",
      detail: `SD holder høyere varmepådrag enn simulert referanse i ${expensiveHeat.length} timer med høy marginalpris på dagtid. Prisresponsiv justering kan redusere kost uten å bryte komfortbånd.`,
      hourSpan: "06–22",
      severity: "warning",
      sampleHours: expensiveHeat.length,
    });
  }

  const setpointHeadroom = rows.filter((r) => {
    const g = r.gjeldende;
    if (g.supplySetpointC == null || g.supplySetpointCalcC == null) return false;
    const gap = g.supplySetpointCalcC - g.supplySetpointC;
    return (
      gap > 0.5 &&
      r.factors.supplySetpointDeltaC < -0.05 &&
      r.effectiveMarginalKrPerKwh != null
    );
  });
  if (setpointHeadroom.length >= 3) {
    points.push({
      id: "setpoint_headroom_unused",
      label: "Ubrukt settpunkt-headroom",
      detail: `SD har operativt settpunkt under kalkulert i ${setpointHeadroom.length} timer — simulert referanse ville senket SP i dyre perioder for å utnytte headroom.`,
      hourSpan: null,
      severity: "opportunity",
      sampleHours: setpointHeadroom.length,
    });
  }

  const coolingMild = rows.filter(
    (r) =>
      r.outdoorTempC != null &&
      r.outdoorTempC >= 8 &&
      r.outdoorTempC <= 16 &&
      (r.gjeldende.coolingValvePct ?? 0) > 10 &&
      (r.scoped.coolingValvePct ?? 0) <
        (r.gjeldende.coolingValvePct ?? 0) - 3,
  );
  if (coolingMild.length >= 2) {
    points.push({
      id: "cooling_mild_weather",
      label: "Kjøling ved mildt vær",
      detail: `Kjøleventil aktiv i ${coolingMild.length} timer med utetemp 8–16 °C der simulert referanse ville dempet unødvendig kjøling.`,
      hourSpan: null,
      severity: "info",
      sampleHours: coolingMild.length,
    });
  }

  if (points.length === 0 && rows.some((r) => r.factors.controlAdjusted)) {
    points.push({
      id: "aligned_with_scoped",
      label: "Styring i tråd med referanse",
      detail:
        "Ingen tydelige forbedringspunkter i valgt periode — gjeldende SD-pådrag ligger nær simulert referanse.",
      hourSpan: null,
      severity: "info",
      sampleHours: rows.length,
    });
  }

  return points.sort((a, b) => {
    const order = { warning: 0, opportunity: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}

export function buildImprovementPointRows(input: {
  hourlyEnergy: readonly ControlHourlyEnergy[];
  gjeldendeByHour: ReadonlyMap<string, ControlSdHourlyProfile>;
  scopedByHour: ReadonlyMap<string, ControlSdHourlyProfile>;
  factorsByHour: ReadonlyMap<string, ScenarioHourFactors>;
  outdoorByHour: ReadonlyMap<string, number | null>;
  effectiveMarginalByHour: ReadonlyMap<string, number | null>;
}): HourRow[] {
  const rows: HourRow[] = [];
  for (const energy of input.hourlyEnergy) {
    const key = controlHourKeyFromIso(energy.hour);
    const gjeldende = input.gjeldendeByHour.get(key);
    const scoped = input.scopedByHour.get(key);
    const factors = input.factorsByHour.get(key);
    if (!gjeldende || !scoped || !factors) continue;
    rows.push({
      hour: energy.hour,
      gjeldende,
      scoped,
      factors,
      energy,
      outdoorTempC: input.outdoorByHour.get(key) ?? null,
      effectiveMarginalKrPerKwh:
        input.effectiveMarginalByHour.get(key) ?? null,
    });
  }
  return rows;
}
