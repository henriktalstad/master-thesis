import "server-only";

import { parseInfluxSqlResponse } from "@/lib/infraspawn/parse-influx-rows";
import type { InfluxQueryParams } from "@/services/infraspawn/types";

export type InfluxQueryResult = {
  rows: ReturnType<typeof parseInfluxSqlResponse>;
  rawBody: string;
};

export async function queryInfluxSql(
  params: InfluxQueryParams,
): Promise<InfluxQueryResult> {
  const host = params.host.replace(/\/$/, "");
  const url = new URL(`${host}/api/v3/query_sql`);
  url.searchParams.set("db", params.database);
  url.searchParams.set("q", params.sql);
  url.searchParams.set("format", params.format ?? "json");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const rawBody = await response.text();
  if (!response.ok) {
    const snippet = rawBody.slice(0, 400).replace(/\s+/g, " ");
    throw new Error(
      `Influx-spørring feilet (${response.status}): ${snippet || response.statusText}`,
    );
  }

  const rows = parseInfluxSqlResponse(rawBody);
  return { rows, rawBody };
}
