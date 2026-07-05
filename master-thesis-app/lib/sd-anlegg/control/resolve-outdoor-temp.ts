export type OutdoorTempSource = "frost" | "bms" | null;

export type ResolvedOutdoorTemp = {
  /** Verdi brukt av MPC (Frost først, deretter BMS). */
  outdoorTempC: number | null;
  outdoorTempFrostC: number | null;
  outdoorTempBmsC: number | null;
  source: OutdoorTempSource;
};

function roundTemp(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

/** Frost (MET observasjon) er primær; BMS `320.001RT901_MV` er fallback og kryssvalidering. */
export function resolveOutdoorTempForStep(input: {
  frostC: number | null | undefined;
  bmsC: number | null | undefined;
}): ResolvedOutdoorTemp {
  const frost = roundTemp(input.frostC);
  const bms = roundTemp(input.bmsC);

  if (frost != null) {
    return {
      outdoorTempC: frost,
      outdoorTempFrostC: frost,
      outdoorTempBmsC: bms,
      source: "frost",
    };
  }
  if (bms != null) {
    return {
      outdoorTempC: bms,
      outdoorTempFrostC: null,
      outdoorTempBmsC: bms,
      source: "bms",
    };
  }
  return {
    outdoorTempC: null,
    outdoorTempFrostC: null,
    outdoorTempBmsC: bms,
    source: null,
  };
}
