/** Fast horisontal layout for 320.001-3 combined — % langs rør-lane (venstre→høyre). */
export const HEATING_COMBINED_SLOT_X = {
  oe: 4,
  heatExchanger: 16,
  valve: 28,
  pump1: 40,
  pump2: 52,
  supplyTemp: 64,
  pressure: 74,
  returnTemp: 86,
} as const;

/** Tur/retur-linjer — bruker mer av diagramhøyden. */
export const HEATING_COMBINED_PIPE_Y = {
  supply: 24,
  center: 50,
  return: 76,
} as const;

export const HEATING_COMBINED_PIPE_RUN = {
  leftMargin: 4,
  rightMargin: 92,
} as const;

/** Referansebredde for design — diagrammet bruker 100 % av container. */
export const HEATING_COMBINED_LANE_MIN_WIDTH_REM = 72;

/** Minimum høyde per gren (bolig/næring). */
export const HEATING_COMBINED_ROW_MIN_HEIGHT_REM = 14;

export const HEATING_COMBINED_ZONE_DIVIDER_X = HEATING_COMBINED_SLOT_X.heatExchanger;

/** Senterposisjon for sonetiketter — matcher primær/sekundær bakgrunn. */
export const HEATING_COMBINED_ZONE_LABEL_X = {
  primary: HEATING_COMBINED_ZONE_DIVIDER_X / 2,
  secondary:
    HEATING_COMBINED_ZONE_DIVIDER_X +
    (100 - HEATING_COMBINED_ZONE_DIVIDER_X) / 2,
} as const;

export const HEATING_COMBINED_ZONE_LABELS = {
  primary: "Primær",
  secondary: "Sekundær",
} as const;

export type HeatingCombinedPipeCircuit = "supply" | "return";

export type HeatingCombinedPipeSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  circuit: HeatingCombinedPipeCircuit;
};

export type HeatingCombinedPipeChevron = {
  cx: number;
  cy: number;
  direction: "left" | "right";
  circuit: HeatingCombinedPipeCircuit;
};

export type HeatingCombinedPipeLabel = {
  text: string;
  x: number;
  y: number;
  circuit: HeatingCombinedPipeCircuit;
  anchor: "start" | "end";
};

export function resolveHeatingCombinedBranchLaneCopy(
  branchId: "residential" | "commercial",
): { elementLabel: string; subtitle: string } {
  switch (branchId) {
    case "residential":
      return { elementLabel: "320.002", subtitle: "Boligdel" };
    case "commercial":
      return { elementLabel: "320.003", subtitle: "Næringsdel" };
  }
}

export type HeatingCombinedPipeTap = {
  x: number;
  y1: number;
  y2: number;
  circuit: HeatingCombinedPipeCircuit;
};

const HEATING_COMBINED_PIPE_TAP_STUB = 6.5;

export function buildHeatingCombinedPipeTaps(): HeatingCombinedPipeTap[] {
  const { supply, return: returnY, center } = HEATING_COMBINED_PIPE_Y;
  const stub = HEATING_COMBINED_PIPE_TAP_STUB;
  const slots = HEATING_COMBINED_SLOT_X;

  return [
    ...([slots.valve, slots.pump1, slots.pump2, slots.supplyTemp] as const).map(
      (x) => ({
        x,
        y1: supply,
        y2: supply + stub,
        circuit: "supply" as const,
      }),
    ),
    {
      x: slots.returnTemp,
      y1: returnY,
      y2: returnY - stub,
      circuit: "return",
    },
    {
      x: slots.pressure,
      y1: center - stub * 0.65,
      y2: center + stub * 0.65,
      circuit: "return",
    },
    {
      x: slots.oe,
      y1: center - stub,
      y2: center + stub,
      circuit: "supply",
    },
  ];
}

export function buildHeatingCombinedPipeSegments(): HeatingCombinedPipeSegment[] {
  const { supply, return: returnY } = HEATING_COMBINED_PIPE_Y;
  const left = HEATING_COMBINED_PIPE_RUN.leftMargin;
  const right = HEATING_COMBINED_PIPE_RUN.rightMargin;
  const hx = HEATING_COMBINED_ZONE_DIVIDER_X;

  return [
    { x1: left, y1: supply, x2: hx, y2: supply, circuit: "supply" },
    { x1: hx, y1: supply, x2: right, y2: supply, circuit: "supply" },
    { x1: right, y1: returnY, x2: hx, y2: returnY, circuit: "return" },
    { x1: hx, y1: returnY, x2: left, y2: returnY, circuit: "return" },
    { x1: hx, y1: supply, x2: hx, y2: returnY, circuit: "supply" },
  ];
}

export function buildHeatingCombinedPipeLabels(): HeatingCombinedPipeLabel[] {
  const { supply, return: returnY } = HEATING_COMBINED_PIPE_Y;
  const left = HEATING_COMBINED_PIPE_RUN.leftMargin;
  const right = HEATING_COMBINED_PIPE_RUN.rightMargin;

  return [
    {
      text: "Tur",
      x: left,
      y: supply - 5,
      circuit: "supply",
      anchor: "start",
    },
    {
      text: "Retur",
      x: right,
      y: returnY + 6,
      circuit: "return",
      anchor: "end",
    },
  ];
}

export function buildHeatingCombinedPipeChevrons(): HeatingCombinedPipeChevron[] {
  const { supply, return: returnY } = HEATING_COMBINED_PIPE_Y;
  const hx = HEATING_COMBINED_ZONE_DIVIDER_X;
  const s = HEATING_COMBINED_SLOT_X;

  const supplyXs = [
    (s.oe + s.heatExchanger) / 2,
    (s.valve + s.pump1) / 2,
    (s.pump2 + s.supplyTemp) / 2,
    (s.supplyTemp + s.pressure) / 2,
  ];
  const returnXs = [
    (s.returnTemp + s.pressure) / 2,
    (s.supplyTemp + s.pump2) / 2,
    (s.pump1 + s.valve) / 2,
    (s.valve + hx) / 2,
  ];

  return [
    ...supplyXs.map((cx) => ({
      cx,
      cy: supply,
      direction: "right" as const,
      circuit: "supply" as const,
    })),
    ...returnXs.filter((cx) => cx < hx - 2 || cx > hx + 4).map((cx) => ({
      cx,
      cy: returnY,
      direction: "left" as const,
      circuit: "return" as const,
    })),
  ];
}
