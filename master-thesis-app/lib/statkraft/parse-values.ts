import type {
  MappedDistrictHeatingMeasurement,
  StatkraftMeterValuesResponse,
  StatkraftQuantity,
} from "@/lib/statkraft/types";

type QuantityValues = {
  energyKwh?: number;
  flowM3h?: number;
  forwardTempC?: number;
  returnTempC?: number;
  diffTempK?: number;
  volumeM3?: number;
};

function convertValue(value: number, unit: string, targetUnit: string): number {
  if (targetUnit === "kWh") {
    if (unit === "MWh") return value * 1000;
    if (unit === "kWh") return value;
  }
  if (targetUnit === "m3" && unit === "m3") return value;
  if (targetUnit === "m3/h" && unit === "m3/h") return value;
  if (targetUnit === "°C" && unit === "°C") return value;
  if (targetUnit === "K" && unit === "K") return value;
  return value;
}

export function parseStatkraftTimestamp(whenZ: number | string): number | null {
  if (typeof whenZ === "number" && Number.isFinite(whenZ)) {
    return whenZ > 1_000_000_000_000 ? whenZ : whenZ * 1000;
  }
  const trimmed = String(whenZ).trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed);
    return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function toNorwegianWallClock(utcTime: Date): Date {
  const osloFormatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = osloFormatter.formatToParts(utcTime);
  const toNumber = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return new Date(
    Date.UTC(
      toNumber("year"),
      toNumber("month") - 1,
      toNumber("day"),
      toNumber("hour"),
      toNumber("minute"),
      toNumber("second"),
    ),
  );
}

export function mapStatkraftMeterValues(
  meterValues: StatkraftMeterValuesResponse,
  quantities: StatkraftQuantity[],
): MappedDistrictHeatingMeasurement[] {
  const valuesByTimestamp = new Map<number, QuantityValues>();

  for (const meterValue of meterValues) {
    if (!meterValue?.values?.length) continue;
    const quantityName = meterValue.quantity;
    if (!quantityName) continue;

    for (const valuePoint of meterValue.values) {
      const utcMs = parseStatkraftTimestamp(valuePoint.when_Z);
      if (utcMs == null) continue;

      if (!valuesByTimestamp.has(utcMs)) {
        valuesByTimestamp.set(utcMs, {});
      }
      const values = valuesByTimestamp.get(utcMs)!;

      switch (quantityName) {
        case "Energy":
          values.energyKwh = convertValue(
            valuePoint.value,
            meterValue.unit,
            "kWh",
          );
          break;
        case "Flow":
          values.flowM3h = convertValue(
            valuePoint.value,
            meterValue.unit,
            "m3/h",
          );
          break;
        case "Forward temperature":
          values.forwardTempC = convertValue(
            valuePoint.value,
            meterValue.unit,
            "°C",
          );
          break;
        case "Return temperature":
          values.returnTempC = convertValue(
            valuePoint.value,
            meterValue.unit,
            "°C",
          );
          break;
        case "Difference temperature":
          values.diffTempK = convertValue(
            valuePoint.value,
            meterValue.unit,
            "K",
          );
          break;
        case "Volume":
          values.volumeM3 = convertValue(
            valuePoint.value,
            meterValue.unit,
            "m3",
          );
          break;
      }
    }
  }

  return [...valuesByTimestamp.entries()]
    .sort(([a], [b]) => a - b)
    .map(([utcMs, values]) => {
      const utcTime = new Date(utcMs);
      let diffTempK = values.diffTempK ?? null;
      if (
        diffTempK == null &&
        values.forwardTempC != null &&
        values.returnTempC != null
      ) {
        diffTempK = Math.abs(values.forwardTempC - values.returnTempC);
      }

      return {
        time: toNorwegianWallClock(utcTime),
        utcTime,
        energyKwh: values.energyKwh ?? null,
        flowM3h: values.flowM3h ?? values.volumeM3 ?? null,
        forwardTempC: values.forwardTempC ?? null,
        returnTempC: values.returnTempC ?? null,
        diffTempK,
        volumeM3: values.volumeM3 ?? null,
        resolution: "hour",
        metadata: {
          source: "statkraft",
          resolution: "hour",
          quantities: quantities.map((q) => ({ name: q.name, unit: q.unit })),
        },
      };
    });
}

export function filterMeasurementsInWindow(
  rows: MappedDistrictHeatingMeasurement[],
  windowStart: Date,
  windowEndExclusive: Date,
): MappedDistrictHeatingMeasurement[] {
  const startMs = windowStart.getTime();
  const endMs = windowEndExclusive.getTime();
  return rows.filter((row) => {
    const ms = row.utcTime.getTime();
    return ms >= startMs && ms < endMs;
  });
}
