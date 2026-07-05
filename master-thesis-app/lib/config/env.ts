import "server-only";

import { z } from "zod";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  BUILDING_SLUG: z.string().min(1).optional(),
  BUILDING_ID: z.string().min(1).optional(),
  INFRASPAWN_SOURCE_ID: z.string().min(1).optional(),
  INFRASPAWN_INFLUX_URL: z.string().url().optional(),
  INFRASPAWN_API_TOKEN: z.string().min(1).optional(),
  CRON_SECRET: z.string().optional(),
  ENTSOE_SECURITY_TOKEN: z.string().min(1).optional(),
  THESIS_PRICE_AREA: z.string().optional(),
  GRID_TARIFF_GROUPS: z.string().optional(),
  GRID_TARIFF_MONTHS_LOOKBACK: z.string().optional(),
  ENERGY_PRICES_HOURLY_LOOKBACK_DAYS: z.string().optional(),
  ENERGY_PRICES_DAILY_LOOKBACK_DAYS: z.string().optional(),
});

export type AppConfig = {
  databaseUrl: string | undefined;
  buildingSlug: string | undefined;
  buildingId: string | undefined;
  infraspawnSourceId: string | undefined;
  infraspawnInfluxUrl: string | undefined;
  infraspawnApiToken: string | undefined;
  cronSecret: string | undefined;
  entsoeSecurityToken: string | undefined;
  thesisPriceArea: string | undefined;
  gridTariffGroups: string | undefined;
};

let cached: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Ugyldig env: ${parsed.error.message}`);
  }

  const e = parsed.data;
  cached = {
    databaseUrl: e.DATABASE_URL,
    buildingSlug: e.BUILDING_SLUG,
    buildingId: e.BUILDING_ID,
    infraspawnSourceId: e.INFRASPAWN_SOURCE_ID,
    infraspawnInfluxUrl: e.INFRASPAWN_INFLUX_URL,
    infraspawnApiToken: e.INFRASPAWN_API_TOKEN,
    cronSecret: e.CRON_SECRET,
    entsoeSecurityToken: e.ENTSOE_SECURITY_TOKEN,
    thesisPriceArea: e.THESIS_PRICE_AREA,
    gridTariffGroups: e.GRID_TARIFF_GROUPS,
  };
  return cached;
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDefaultBuildingSlug(): string {
  return resolveBuildingSlug();
}

export function sdAnleggPath(buildingSlug?: string): string {
  const slug = buildingSlug ?? getDefaultBuildingSlug();
  return `/sd-anlegg/${slug}`;
}

export function sdAnleggStyringPath(buildingSlug?: string): string {
  return `${sdAnleggPath(buildingSlug)}/styring`;
}

export function sdAnleggVentilationUnitPath(
  unitSlug: string,
  buildingSlug?: string,
): string {
  return `${sdAnleggPath(buildingSlug)}/ventilasjon/${unitSlug}`;
}
