const UNIT_LABELS: Record<string, string> = {
  "degrees-celsius": "°C",
  "degree-celsius": "°C",
  celsius: "°C",
  "degrees-fahrenheit": "°F",
  kilowatts: "kW",
  kilowatt: "kW",
  "kilowatt-hours": "kWh",
  "kilowatt-hour": "kWh",
  "cubic-meters-per-hour": "m³/h",
  "cubic-meters": "m³",
  "cubic-meter": "m³",
  pascals: "Pa",
  pascal: "Pa",
  pa: "Pa",
  percent: "%",
  "percent-relative": "%",
  "no-units": "",
  boolean: "",
  "°c": "°C",
  c: "°C",
};

export function formatInfraspawnUnit(unit: string | null | undefined): string | null {
  const raw = unit?.trim();
  if (!raw) return null;

  const normalized = raw.toLowerCase();
  const exact = UNIT_LABELS[normalized];
  if (exact != null) return exact || null;

  if (normalized.includes("degree") && normalized.includes("celsius")) {
    return "°C";
  }
  if (normalized.includes("kilowatt-hour")) return "kWh";
  if (normalized.includes("kilowatt")) return "kW";
  if (normalized.includes("pascal") || normalized === "pa") return "Pa";
  if (normalized.includes("cubic-meters-per-hour")) return "m³/h";
  if (normalized.includes("percent")) return "%";

  if (raw.length <= 6 && !raw.includes("-")) return raw;

  return raw
    .replace(/degrees-celsius/gi, "°C")
    .replace(/kilowatt-hours/gi, "kWh")
    .replace(/kilowatts/gi, "kW")
    .replace(/cubic-meters-per-hour/gi, "m³/h")
    .replace(/percent/gi, "%");
}
