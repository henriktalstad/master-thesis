import "server-only";

import { resolveInfluxTableName } from "@/lib/infraspawn/influx-table";
import type { SdAnleggInfluxCredentials } from "@/lib/infraspawn/sd-anlegg-series";
import { getAppConfig } from "@/lib/config/env";
import { decrypt } from "@/services/integrations/manager";

export type InfraspawnSourceCredentialRow = {
  id: string;
  label?: string | null;
  influxDatabase: string;
  apiTokenEncrypted: string;
  metadata: unknown;
};

export function resolveInfluxApiToken(apiTokenEncrypted: string): string {
  const config = getAppConfig();
  return config.infraspawnApiToken || decrypt(apiTokenEncrypted);
}

export function resolveSourceInfluxCredentials(
  sources: readonly InfraspawnSourceCredentialRow[],
): Map<string, SdAnleggInfluxCredentials> {
  const config = getAppConfig();
  const envUrl = config.infraspawnInfluxUrl;

  return new Map(
    sources.map((source) => {
      const token = resolveInfluxApiToken(source.apiTokenEncrypted);
      return [
        source.id,
        {
          token,
          database: source.influxDatabase,
          tableName: resolveInfluxTableName(source.metadata),
          ...(envUrl ? { host: envUrl.replace(/\/$/, "") } : {}),
        },
      ];
    }),
  );
}
