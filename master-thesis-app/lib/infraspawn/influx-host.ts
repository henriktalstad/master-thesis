import { getAppConfig } from "@/lib/config/env";

export const DEFAULT_INFRASPAWN_INFLUX_HOST =
  "https://influx.scoped.cloud:4433";

/** Influx v3 SQL-endepunkt (base URL uten trailing slash). */
export function getInfraspawnInfluxHost(): string {
  const config = getAppConfig();
  const raw =
    config.infraspawnInfluxUrl?.trim() ||
    process.env.INFRASPAWN_INFLUX_HOST?.trim();
  if (!raw) return DEFAULT_INFRASPAWN_INFLUX_HOST;
  return raw.replace(/\/$/, "");
}
