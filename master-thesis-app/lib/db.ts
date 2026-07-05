import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/client";
import { assertThesisDatabaseUrl, normalizePgConnectionString } from "@/lib/config/thesis-db";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL (eller DIRECT_URL) må være satt for Prisma-tilkobling.",
    );
  }

  const isPlaceholder =
    url.includes("@127.0.0.1:5432/placeholder") ||
    url.includes("prisma-generate-placeholder");

  if (!isPlaceholder) {
    assertThesisDatabaseUrl();
  }

  return normalizePgConnectionString(url);
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Prisma default interactive tx timeout is 5s — too low for Neon + large JSON upserts. */
export const PRISMA_TX_TIMEOUT_MS = 60_000;

function isRetryablePrismaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  if (
    code === "P2028" ||
    code === "P2034" ||
    code === "P1001" ||
    code === "P1002" ||
    code === "P1008" ||
    code === "P1017"
  ) {
    return true;
  }
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  return (
    message.includes("connection") ||
    message.includes("terminated unexpectedly") ||
    message.includes("timeout") ||
    message.includes("deadlock")
  );
}

/** Varm pool etter lange CPU-jobber (replay) før persist. */
export async function ensurePrismaConnection(): Promise<void> {
  await withPrismaRetry(() => prisma.$connect(), {
    retries: 3,
    delayMs: 250,
  });
}

/** Prøver transient DB-feil på nytt (deadlock, connection drop). */
export async function withPrismaRetry<T>(
  fn: () => Promise<T>,
  options?: { retries?: number; delayMs?: number },
): Promise<T> {
  const retries = options?.retries ?? 3;
  const delayMs = options?.delayMs ?? 100;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries || !isRetryablePrismaError(error)) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, delayMs * (attempt + 1)),
      );
    }
  }

  throw new Error("withPrismaRetry: unreachable");
}
