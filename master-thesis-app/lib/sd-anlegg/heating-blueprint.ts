/** Fast layout for fjernvarme-mal — koordinater som % av lane-bredde. */
export const HEATING_DISTRICT_TEMPLATE_ID = "heating.district.secondary_circuit";

export type HeatingDistrictSection = "primary" | "tapwater" | "secondary" | "status";

export type HeatingDistrictSlotLayout = {
  section: HeatingDistrictSection;
  /** 0–100 langs rør-lane */
  x: number;
  order: number;
};

export const HEATING_DISTRICT_SLOT_LAYOUT: Record<string, HeatingDistrictSlotLayout> =
  {
    "primary.supply_temp": { section: "primary", x: 10, order: 1 },
    "primary.return_temp": { section: "primary", x: 28, order: 2 },
    "primary.power": { section: "primary", x: 46, order: 3 },
    "primary.energy": { section: "primary", x: 58, order: 4 },
    "primary.flow": { section: "primary", x: 70, order: 5 },
    "primary.volume": { section: "primary", x: 82, order: 6 },
    "compensation.outdoor_temp": { section: "primary", x: 94, order: 7 },
    "tapwater.supply_temp": { section: "tapwater", x: 18, order: 1 },
    "tapwater.valve": { section: "tapwater", x: 48, order: 2 },
    "tapwater.pump": { section: "tapwater", x: 78, order: 3 },
    "secondary.valve": { section: "secondary", x: 10, order: 1 },
    "secondary.pump_1": { section: "secondary", x: 26, order: 2 },
    "secondary.pump_2": { section: "secondary", x: 42, order: 3 },
    "secondary.supply_temp": { section: "secondary", x: 58, order: 4 },
    "secondary.pressure": { section: "secondary", x: 74, order: 5 },
    "secondary.return_temp": { section: "secondary", x: 90, order: 6 },
    "status.setpoint": { section: "status", x: 50, order: 1 },
  };

export const HEATING_DISTRICT_LANE_LABELS: Record<
  Exclude<HeatingDistrictSection, "status">,
  string
> = {
  primary: "Primær fjernvarme",
  tapwater: "Tappevann TR001",
  secondary: "Sekundærkrets",
};

export function resolveHeatingRegulationLabel(
  elementKey?: string | null,
): string {
  switch (elementKey) {
    case "320001":
      return "Primær 320.001";
    case "320002":
      return "TR002 Boligdel";
    case "320003":
      return "TR003 Næringsdel";
    default:
      return "Fjernvarme";
  }
}

export function resolveHeatingSecondaryLaneLabel(
  elementKey?: string | null,
): string {
  switch (elementKey) {
    case "320002":
      return "Boligdel TR002";
    case "320003":
      return "Næringsdel TR003";
    default:
      return HEATING_DISTRICT_LANE_LABELS.secondary;
  }
}

export function shouldShowTapWaterLane(elementKey?: string | null): boolean {
  return elementKey === "320002" || elementKey == null;
}
