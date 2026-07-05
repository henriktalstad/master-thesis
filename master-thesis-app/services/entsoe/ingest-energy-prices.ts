import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/client";
import { EnergyPriceSource } from "@/generated/client/enums";

interface EnergyPrice {
  date: string;
  price: number;
  areaCode: string;
  region: string;
  type: "QUARTER_HOURLY" | "HOURLY" | "DAILY";
  hour?: number;
  quarter?: number;
}

export type IngestEnergyPricesOptions = {
  source?: EnergyPriceSource;
};

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const ROWS_PER_TRANSACTION = 350;

const TRANSIENT_ERROR_CODES = new Set([
  "P2028",
  "P1017",
  "P1001",
  "P2034",
]);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}

function isTransientError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  if (code != null && TRANSIENT_ERROR_CODES.has(code)) return true;
  const msg = errorMessage(error).toLowerCase();
  return (
    msg.includes("connection terminated") ||
    msg.includes("timeout expired") ||
    msg.includes("can't reach database") ||
    msg.includes("econnreset") ||
    msg.includes("connection closed")
  );
}

async function runOneChunk(
  quarterHourlyChunk: EnergyPrice[],
  hourlyChunk: EnergyPrice[],
  dailyChunk: EnergyPrice[],
  maxRetries: number,
  source: EnergyPriceSource,
): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          if (quarterHourlyChunk.length > 0) {
            await processQuarterHourlyPrices(tx, quarterHourlyChunk, source);
          }
          if (hourlyChunk.length > 0) {
            await processHourlyPrices(tx, hourlyChunk, source);
          }
          if (dailyChunk.length > 0) {
            await processDailyPrices(tx, dailyChunk, source);
          }
        },
        { timeout: 45000, maxWait: 15000 },
      );
      return;
    } catch (error: unknown) {
      lastError = error;
      if (!isTransientError(error) || attempt >= maxRetries) throw error;
      const backoffMs = Math.min(
        500 * 2 ** attempt + Math.random() * 300,
        8000,
      );
      console.warn(
        `⚠️ [ingestEnergyPrices] Chunk transaksjon feilet (forsøk ${attempt + 1}/${maxRetries + 1}), venter ${Math.round(backoffMs)}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastError;
}

export async function ingestEnergyPrices(
  prices: EnergyPrice[],
  options?: IngestEnergyPricesOptions,
): Promise<void> {
  if (!prices || prices.length === 0) {
    console.log("Ingen priser å lagre");
    return;
  }

  const source: EnergyPriceSource = options?.source ?? EnergyPriceSource.ENTSOE;

  const quarterHourlyPrices = prices.filter((p) => p.type === "QUARTER_HOURLY");
  const hourlyPrices = prices.filter((p) => p.type === "HOURLY");
  const dailyPrices = prices.filter((p) => p.type === "DAILY");

  console.log(
    `Starter lagring av ${prices.length} energipriser (kilde: ${source})...`,
  );
  console.log(
    `Fordeling: ${quarterHourlyPrices.length} 15-min, ${hourlyPrices.length} time, ${dailyPrices.length} dag`,
  );

  const maxRetries = 3;
  const chunkCount = Math.max(
    Math.ceil(quarterHourlyPrices.length / ROWS_PER_TRANSACTION),
    Math.ceil(hourlyPrices.length / ROWS_PER_TRANSACTION),
    Math.ceil(dailyPrices.length / ROWS_PER_TRANSACTION),
    1,
  );

  for (let i = 0; i < chunkCount; i++) {
    const qStart = i * ROWS_PER_TRANSACTION;
    const hStart = i * ROWS_PER_TRANSACTION;
    const dStart = i * ROWS_PER_TRANSACTION;

    const quarterChunk = quarterHourlyPrices.slice(
      qStart,
      qStart + ROWS_PER_TRANSACTION,
    );
    const hourlyChunk = hourlyPrices.slice(hStart, hStart + ROWS_PER_TRANSACTION);
    const dailyChunk = dailyPrices.slice(dStart, dStart + ROWS_PER_TRANSACTION);

    if (
      quarterChunk.length === 0 &&
      hourlyChunk.length === 0 &&
      dailyChunk.length === 0
    ) {
      continue;
    }

    await runOneChunk(
      quarterChunk,
      hourlyChunk,
      dailyChunk,
      maxRetries,
      source,
    );
  }

  console.log("Energipriser lagret i databasen");
}

function normalizeDate(dateStr: string): Date {
  const parsed = new Date(dateStr);
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
  }

  const datePart = String(dateStr).split("T")[0] ?? String(dateStr);
  const fallback = new Date(`${datePart}T00:00:00Z`);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  throw new Error(
    `Ugyldig datoformat i ingestEnergyPrices.normalizeDate: ${String(dateStr)}`,
  );
}

function getHourFromDateString(dateStr: string): number {
  return new Date(dateStr).getUTCHours();
}

function getQuarterFromDateString(dateStr: string): number {
  return Math.floor(new Date(dateStr).getUTCMinutes() / 15);
}

async function processQuarterHourlyPrices(
  tx: TransactionClient,
  prices: EnergyPrice[],
  source: EnergyPriceSource,
): Promise<void> {
  const upserts = prices.map((price) => {
    const normalizedDate = normalizeDate(price.date);
    const hour = price.hour ?? getHourFromDateString(price.date);
    const quarter = price.quarter ?? getQuarterFromDateString(price.date);

    return {
      where: {
        date_hour_quarter_areaCode: {
          date: normalizedDate,
          hour,
          quarter,
          areaCode: price.areaCode,
        },
      },
      update: { price: price.price, source },
      create: {
        date: normalizedDate,
        hour,
        quarter,
        price: price.price,
        areaCode: price.areaCode,
        source,
      },
    };
  });

  await upsertInBatches(tx, upserts, (u) =>
    tx.quarterHourlyEnergyPrices.upsert(u),
  );
  console.log(`Prosessert ${upserts.length} 15-min priser (kilde: ${source})`);
}

async function processHourlyPrices(
  tx: TransactionClient,
  prices: EnergyPrice[],
  source: EnergyPriceSource,
): Promise<void> {
  const upserts = prices.map((price) => {
    const normalizedDate = normalizeDate(price.date);
    const hour = getHourFromDateString(price.date);

    return {
      where: {
        date_hour_areaCode: {
          date: normalizedDate,
          hour,
          areaCode: price.areaCode,
        },
      },
      update: { price: price.price, source },
      create: {
        date: normalizedDate,
        hour,
        price: price.price,
        areaCode: price.areaCode,
        source,
      },
    };
  });

  await upsertInBatches(tx, upserts, (u) => tx.hourlyEnergyPrices.upsert(u));
  console.log(`Prosessert ${upserts.length} timepriser (kilde: ${source})`);
}

async function processDailyPrices(
  tx: TransactionClient,
  prices: EnergyPrice[],
  source: EnergyPriceSource,
): Promise<void> {
  const upserts = prices.map((price) => {
    const dateIso =
      typeof price.date === "string"
        ? price.date
        : String(price.date ?? new Date().toISOString());
    const datePart = dateIso.split("T")[0];
    const dailyDate = new Date(`${datePart}T00:00:00Z`);

    return {
      where: {
        date_areaCode: {
          date: dailyDate,
          areaCode: price.areaCode,
        },
      },
      update: { averagePrice: price.price, source },
      create: {
        date: dailyDate,
        averagePrice: price.price,
        areaCode: price.areaCode,
        source,
      },
    };
  });

  await upsertInBatches(tx, upserts, (u) => tx.dailyEnergyPrices.upsert(u));
  console.log(`Prosessert ${upserts.length} daglige priser (kilde: ${source})`);
}

async function upsertInBatches<T>(
  tx: TransactionClient,
  upserts: T[],
  run: (upsert: T) => Promise<unknown>,
): Promise<void> {
  if (upserts.length === 0) return;
  const BATCH_SIZE = 50;
  const CONCURRENCY = 4;
  for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
    const batch = upserts.slice(i, i + BATCH_SIZE);
    for (let j = 0; j < batch.length; j += CONCURRENCY) {
      const slice = batch.slice(j, j + CONCURRENCY);
      await Promise.all(slice.map((upsert) => run(upsert)));
    }
  }
}
