import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILES = [".env.local", ".env"] as const;

export const PLACEHOLDER_DATABASE_URL =
  "postgresql://prisma-generate-placeholder:placeholder@127.0.0.1:5432/placeholder?schema=public";

export function loadPrismaEnv(cwd = process.cwd()): void {
  for (const file of ENV_FILES) {
    config({ path: resolve(cwd, file), quiet: true });
  }
}

export type PrismaDatasourceConfig = {
  url: string;
  directUrl?: string;
  shadowDatabaseUrl?: string;
};

export function resolvePrismaDatasource(
  _cwd = process.cwd(),
): PrismaDatasourceConfig {
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

  return {
    url: databaseUrl ?? directUrl ?? PLACEHOLDER_DATABASE_URL,
    ...(directUrl ? { directUrl } : {}),
    ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
  };
}

export function formatPrismaEnvStatus(cwd = process.cwd()): string {
  const filesOnDisk = ENV_FILES.filter((file) =>
    existsSync(resolve(cwd, file)),
  );
  const filesLabel =
    filesOnDisk.length > 0 ? filesOnDisk.join(", ") : "ingen .env-filer";

  const parts: string[] = [];
  if (process.env.DATABASE_URL) {
    parts.push("DATABASE_URL (pooler, runtime)");
  }
  if (process.env.DIRECT_URL) {
    parts.push("DIRECT_URL (direkte, migrasjoner)");
  }

  if (parts.length === 0) {
    return `Prisma env: placeholder — filer på disk: ${filesLabel}`;
  }

  return `Prisma env: ${parts.join(" + ")} — filer på disk: ${filesLabel}`;
}

export function shouldLogPrismaEnv(): boolean {
  if (process.env.PRISMA_ENV_QUIET) return false;
  const argv = process.argv.join(" ");
  return !/\b(generate|validate)\b/.test(argv);
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL ?? process.env.DIRECT_URL);
}
