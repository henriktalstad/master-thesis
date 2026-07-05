export type { InfraspawnBacnetRow } from "@/lib/infraspawn/types";

export type InfluxQueryParams = {
  host: string;
  token: string;
  database: string;
  sql: string;
  format?: "json" | "pretty";
};
