import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

export type DistrictCircuitId = "tr002" | "tr003";

export type DistrictDeltaTStats = {
  circuit: DistrictCircuitId;
  /** ΔT = tur − retur fra BMS-følere på kretsen. */
  bmsAvgDeltaTC: number | null;
  bmsSteps: number;
  /** ΔT = tur − retur fra OE001-måler (uavhengig av BMS-følerne). */
  meterAvgDeltaTC: number | null;
  meterSteps: number;
  /** meterAvgDeltaTC − bmsAvgDeltaTC når begge finnes — avslører følerdrift/feilkobling. */
  gapC: number | null;
};

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * ΔT tur/retur per fjernvarmekrets (TR002/TR003) — kryssvalidert mellom BMS-følere
 * og OE001-måler. To uavhengige mål på samme fysiske størrelse: stort avvik
 * indikerer følerdrift, feil kobling, eller at kretsen står stille (~0 flow).
 */
export function buildDistrictDeltaTCrossValidation(
  steps: readonly MpcReplayStep[],
): DistrictDeltaTStats[] {
  return (["tr002", "tr003"] as const).map((circuit): DistrictDeltaTStats => {
    const bmsDeltas: number[] = [];
    const meterDeltas: number[] = [];

    for (const step of steps) {
      const bmsSupply =
        circuit === "tr002" ? step.districtTr002SupplyTempC : step.districtTr003SupplyTempC;
      const bmsReturn =
        circuit === "tr002" ? step.districtTr002ReturnTempC : step.districtTr003ReturnTempC;
      if (bmsSupply != null && bmsReturn != null) {
        bmsDeltas.push(bmsSupply - bmsReturn);
      }

      const meterSupply =
        circuit === "tr002"
          ? step.districtMeterTr002SupplyTempC
          : step.districtMeterTr003SupplyTempC;
      const meterReturn =
        circuit === "tr002"
          ? step.districtMeterTr002ReturnTempC
          : step.districtMeterTr003ReturnTempC;
      if (meterSupply != null && meterReturn != null) {
        meterDeltas.push(meterSupply - meterReturn);
      }
    }

    const bmsAvg = average(bmsDeltas);
    const meterAvg = average(meterDeltas);

    return {
      circuit,
      bmsAvgDeltaTC: bmsAvg != null ? round1(bmsAvg) : null,
      bmsSteps: bmsDeltas.length,
      meterAvgDeltaTC: meterAvg != null ? round1(meterAvg) : null,
      meterSteps: meterDeltas.length,
      gapC: bmsAvg != null && meterAvg != null ? round1(meterAvg - bmsAvg) : null,
    };
  });
}
