import { parseStringPromise } from "xml2js";

export type SubHourlyEurPoint = {
  instant: Date;
  priceEurPerMwh: number;
};

function parseEntsoeDateTime(input: string): Date | null {
  if (!input || typeof input !== "string") return null;

  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+\-]\d{2}:?\d{2})?$/.test(
      input,
    )
  ) {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  const compact = input.replace(/Z$/i, "");
  if (/^\d{12}$/.test(compact)) {
    const year = Number(compact.slice(0, 4));
    const month = Number(compact.slice(4, 6)) - 1;
    const day = Number(compact.slice(6, 8));
    const hour = Number(compact.slice(8, 10));
    const minute = Number(compact.slice(10, 12));
    const d = new Date(Date.UTC(year, month, day, hour, minute, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(input);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function resolutionStepHours(resolution: string): number {
  if (resolution === "PT15M") return 0.25;
  if (resolution === "PT30M") return 0.5;
  if (resolution === "PT1H") return 1;
  return 1;
}

function expandToQuarterHourlyPoints(
  instant: Date,
  priceEurPerMwh: number,
): SubHourlyEurPoint[] {
  const out: SubHourlyEurPoint[] = [];
  for (let q = 0; q < 4; q++) {
    out.push({
      instant: new Date(instant.getTime() + q * 15 * 60 * 1000),
      priceEurPerMwh,
    });
  }
  return out;
}

export async function parseEntsoeXmlSubHourly(
  xmlData: string,
): Promise<SubHourlyEurPoint[]> {
  try {
    const jsonData = await parseStringPromise(xmlData);

    if (jsonData.Acknowledgement_MarketDocument) {
      return [];
    }

    if (
      !jsonData.Publication_MarketDocument ||
      !jsonData.Publication_MarketDocument.TimeSeries
    ) {
      throw new Error(
        "Ugyldig XML-format: Mangler Publication_MarketDocument eller TimeSeries",
      );
    }

    const allTimeSeries = jsonData.Publication_MarketDocument.TimeSeries || [];
    const subHourlyPoints: SubHourlyEurPoint[] = [];

    for (const timeSeries of allTimeSeries) {
      if (!timeSeries.Period || !timeSeries.Period[0]) continue;

      const period = timeSeries.Period[0];
      if (
        !period.timeInterval ||
        !period.timeInterval[0] ||
        !period.timeInterval[0].start
      ) {
        continue;
      }
      if (!period.Point || period.Point.length === 0) continue;

      const startTimeStr = period.timeInterval[0].start[0];
      const startTime = parseEntsoeDateTime(startTimeStr);
      if (!startTime) {
        console.warn(
          `Ugyldig startdato fra ENTSOE: "${startTimeStr}" — hopper over denne TimeSeries`,
        );
        continue;
      }

      const resolution = period.resolution ? period.resolution[0] : "PT1H";
      const stepHours = resolutionStepHours(resolution);

      for (const point of period.Point) {
        const position = parseInt(point.position[0], 10);
        const priceAmount = point["price.amount"]
          ? point["price.amount"][0]
          : undefined;
        if (!priceAmount) continue;

        const price = parseFloat(priceAmount);
        if (isNaN(price)) continue;

        const pointTime = new Date(
          startTime.getTime() + (position - 1) * stepHours * 60 * 60 * 1000,
        );

        if (resolution === "PT15M" || resolution === "PT30M") {
          subHourlyPoints.push({ instant: pointTime, priceEurPerMwh: price });
          continue;
        }

        subHourlyPoints.push(
          ...expandToQuarterHourlyPoints(pointTime, price),
        );
      }
    }

    return subHourlyPoints;
  } catch (error) {
    console.error("Feil ved parsing eller prosessering av data:", error);
    return [];
  }
}
