import "server-only";

import { getInfraspawnInfluxHost } from "@/lib/infraspawn/influx-host";
import { resolveInfluxTableNameFromInput } from "@/lib/infraspawn/influx-table";
import { queryInfluxSql } from "@/services/infraspawn/influx-query";

export type InfraspawnConnectionTestResult = {
  success: boolean;
  rowCount: number;
  message: string;
};

export async function testInfraspawnInfluxConnection(input: {
  token: string;
  influxDatabase: string;
  tableName?: string;
}): Promise<InfraspawnConnectionTestResult> {
  const table = resolveInfluxTableNameFromInput(input.tableName);
  const sql = `SELECT * FROM ${table} WHERE time >= now() - INTERVAL '30 seconds' ORDER BY time DESC LIMIT 5`;

  try {
    const { rows } = await queryInfluxSql({
      host: getInfraspawnInfluxHost(),
      token: input.token,
      database: input.influxDatabase,
      sql,
      format: "json",
    });

    if (rows.length === 0) {
      return {
        success: true,
        rowCount: 0,
        message:
          "Tilkobling OK, men ingen rader i siste 30 sekunder (anlegget kan være stille).",
      };
    }

    return {
      success: true,
      rowCount: rows.length,
      message: `Tilkobling OK (${rows.length} sample${rows.length === 1 ? "" : "s"}).`,
    };
  } catch (error) {
    return {
      success: false,
      rowCount: 0,
      message:
        error instanceof Error ? error.message : "Ukjent feil mot Influx",
    };
  }
}
