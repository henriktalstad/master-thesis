import { prisma } from "@/lib/db";
import { addUtcDays, utcDayMidnight } from "@/lib/energy-prices/day-utils";
import { osloYmdFromDate } from "@/lib/utils";
import { getDayAheadPriceBundle } from "@/services/entsoe/get-day-ahead-prices";
import { resolveThesisAreaCode } from "@/lib/thesis/resolve-thesis-area-code";

export type PriceValidationSample = {
  osloYmd: string;
  hourUtc: number;
  nordPoolKrPerKwh: number;
  entsoeKrPerKwh: number;
  deltaKrPerKwh: number;
  deltaPct: number;
};

export type ValidateEnergyPricesResult = {
  areaCode: string;
  sampleDays: number;
  comparedHours: number;
  maxDeltaKrPerKwh: number;
  meanAbsDeltaKrPerKwh: number;
  medianAbsDeltaKrPerKwh: number;
  hoursOverThreshold: number;
  thresholdKrPerKwh: number;
  worstSamples: PriceValidationSample[];
  message: string;
  ok: boolean;
};

export async function validateEnergyPricesAgainstEntsoe(input?: {
  sampleDays?: number;
  thresholdKrPerKwh?: number;
  areaCode?: string;
}): Promise<ValidateEnergyPricesResult> {
  const areaCode = input?.areaCode ?? (await resolveThesisAreaCode());
  const sampleDays = input?.sampleDays ?? Number(process.env.ENERGY_VALIDATE_SAMPLE_DAYS ?? "7");
  const thresholdKrPerKwh =
    input?.thresholdKrPerKwh ??
    Number(process.env.ENERGY_VALIDATE_THRESHOLD_KR ?? "0.05");

  const today = utcDayMidnight(new Date());
  const samples: PriceValidationSample[] = [];

  for (let i = 1; i <= sampleDays; i++) {
    const day = addUtcDays(today, -i);
    const dayEnd = addUtcDays(day, 1);
    const targetOslo = osloYmdFromDate(day);

    const nordPoolRows = await prisma.hourlyEnergyPrices.findMany({
      where: {
        areaCode,
        source: "NORD_POOL",
        date: { gte: day, lt: dayEnd },
      },
      select: { date: true, hour: true, price: true },
    });

    if (nordPoolRows.length < 12) continue;

    const entsoe = await getDayAheadPriceBundle(areaCode, day, "A01");
    const entsoeByHour = new Map<number, number>();
    for (const h of entsoe.hourly) {
      entsoeByHour.set(new Date(h.date).getUTCHours(), h.price);
    }

    for (const row of nordPoolRows) {
      if (!row.date || row.hour == null || row.price == null) continue;
      const entsoePrice = entsoeByHour.get(row.hour);
      if (entsoePrice == null) continue;

      const delta = entsoePrice - row.price;
      const deltaPct =
        row.price !== 0 ? (Math.abs(delta) / Math.abs(row.price)) * 100 : 0;

      samples.push({
        osloYmd: targetOslo,
        hourUtc: row.hour,
        nordPoolKrPerKwh: row.price,
        entsoeKrPerKwh: entsoePrice,
        deltaKrPerKwh: delta,
        deltaPct,
      });
    }
  }

  if (samples.length === 0) {
    return {
      areaCode,
      sampleDays,
      comparedHours: 0,
      maxDeltaKrPerKwh: 0,
      meanAbsDeltaKrPerKwh: 0,
      medianAbsDeltaKrPerKwh: 0,
      hoursOverThreshold: 0,
      thresholdKrPerKwh,
      worstSamples: [],
      ok: false,
      message:
        "Ingen sammenlignbare timer — importer NORD_POOL CSV for historiske dager først",
    };
  }

  const absDeltas = samples.map((s) => Math.abs(s.deltaKrPerKwh));
  absDeltas.sort((a, b) => a - b);
  const maxDeltaKrPerKwh = Math.max(...absDeltas);
  const meanAbsDeltaKrPerKwh =
    absDeltas.reduce((a, b) => a + b, 0) / absDeltas.length;
  const medianAbsDeltaKrPerKwh =
    absDeltas[Math.floor(absDeltas.length / 2)] ?? 0;
  const hoursOverThreshold = absDeltas.filter(
    (d) => d > thresholdKrPerKwh,
  ).length;

  const worstSamples = [...samples]
    .sort(
      (a, b) =>
        Math.abs(b.deltaKrPerKwh) - Math.abs(a.deltaKrPerKwh),
    )
    .slice(0, 10);

  return {
    areaCode,
    sampleDays,
    comparedHours: samples.length,
    maxDeltaKrPerKwh: parseFloat(maxDeltaKrPerKwh.toFixed(4)),
    meanAbsDeltaKrPerKwh: parseFloat(meanAbsDeltaKrPerKwh.toFixed(4)),
    medianAbsDeltaKrPerKwh: parseFloat(medianAbsDeltaKrPerKwh.toFixed(4)),
    hoursOverThreshold,
    thresholdKrPerKwh,
    worstSamples,
    ok: hoursOverThreshold === 0,
    message:
      hoursOverThreshold === 0
        ? `ENTSO-E og NORD_POOL innen ${thresholdKrPerKwh} kr/kWh for ${samples.length} timer`
        : `${hoursOverThreshold}/${samples.length} timer over terskel ${thresholdKrPerKwh} kr/kWh — bruk NORD_POOL for historikk`,
  };
}
