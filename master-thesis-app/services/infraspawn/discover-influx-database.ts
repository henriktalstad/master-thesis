import "server-only";

import { getInfraspawnInfluxHost } from "@/lib/infraspawn/influx-host";
import {
  INFRASPAWN_DEFAULT_INFLUX_DATABASE,
  orderInfluxDatabaseProbeCandidates,
  parseInfluxConfigureDatabaseResponse,
  selectInfluxDatabaseCandidate,
  type InfraspawnInfluxDatabaseDiscoveryMethod,
} from "@/lib/infraspawn/influx-database-discovery";
import { resolveInfluxTableNameFromInput } from "@/lib/infraspawn/influx-table";
import { queryInfluxSql } from "@/services/infraspawn/influx-query";

export type DiscoverInfluxDatabaseResult =
  | {
      success: true;
      influxDatabase: string;
      method: InfraspawnInfluxDatabaseDiscoveryMethod;
      candidates: string[];
    }
  | {
      success: false;
      error: string;
      candidates: string[];
    };

async function listInfluxDatabasesViaConfigure(input: {
  host: string;
  token: string;
}): Promise<string[] | null> {
  const url = new URL(`${input.host.replace(/\/$/, "")}/api/v3/configure/database`);
  url.searchParams.set("format", "json");

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${input.token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const body = await response.text();
    const databases = parseInfluxConfigureDatabaseResponse(body);
    return databases.length > 0 ? databases : null;
  } catch {
    return null;
  }
}

async function probeInfluxDatabase(input: {
  host: string;
  token: string;
  database: string;
  tableName?: string;
}): Promise<boolean> {
  const table = resolveInfluxTableNameFromInput(input.tableName);
  const sql = `SELECT * FROM ${table} WHERE time >= now() - INTERVAL '30 seconds' ORDER BY time DESC LIMIT 1`;

  try {
    await queryInfluxSql({
      host: input.host,
      token: input.token,
      database: input.database,
      sql,
      format: "json",
    });
    return true;
  } catch {
    return false;
  }
}

async function resolveViaProbe(input: {
  host: string;
  token: string;
  candidates: string[];
  tableName?: string;
  method: InfraspawnInfluxDatabaseDiscoveryMethod;
}): Promise<DiscoverInfluxDatabaseResult> {
  const ordered = orderInfluxDatabaseProbeCandidates(input.candidates);

  for (const database of ordered) {
    const ok = await probeInfluxDatabase({
      host: input.host,
      token: input.token,
      database,
      tableName: input.tableName,
    });
    if (ok) {
      return {
        success: true,
        influxDatabase: database,
        method: input.method,
        candidates: ordered,
      };
    }
  }

  return {
    success: false,
    error:
      "Fant ingen tilgjengelig Influx-database for denne nøkkelen. Sjekk at anlegget sender data.",
    candidates: ordered,
  };
}

export async function discoverInfluxDatabase(input: {
  token: string;
  host?: string;
  tableName?: string;
}): Promise<DiscoverInfluxDatabaseResult> {
  const host = input.host ?? getInfraspawnInfluxHost();
  const configured = await listInfluxDatabasesViaConfigure({
    host,
    token: input.token,
  });

  if (configured && configured.length > 0) {
    const selected = selectInfluxDatabaseCandidate(configured);
    if (selected && configured.length === 1) {
      const ok = await probeInfluxDatabase({
        host,
        token: input.token,
        database: selected,
        tableName: input.tableName,
      });
      if (ok) {
        return {
          success: true,
          influxDatabase: selected,
          method: "configure",
          candidates: configured,
        };
      }
    }

    return resolveViaProbe({
      host,
      token: input.token,
      candidates: configured,
      tableName: input.tableName,
      method: configured.length === 1 ? "configure" : "fallback",
    });
  }

  return resolveViaProbe({
    host,
    token: input.token,
    candidates: [INFRASPAWN_DEFAULT_INFLUX_DATABASE],
    tableName: input.tableName,
    method: "probe",
  });
}

export async function resolveInfluxDatabaseForToken(input: {
  token: string;
  influxDatabase?: string;
  tableName?: string;
}): Promise<
  | { success: true; influxDatabase: string; method?: InfraspawnInfluxDatabaseDiscoveryMethod }
  | { success: false; error: string }
> {
  const explicit = input.influxDatabase?.trim();
  if (explicit) {
    return { success: true, influxDatabase: explicit };
  }

  const discovered = await discoverInfluxDatabase({
    token: input.token,
    tableName: input.tableName,
  });

  if (!discovered.success) {
    return { success: false, error: discovered.error };
  }

  return {
    success: true,
    influxDatabase: discovered.influxDatabase,
    method: discovered.method,
  };
}
