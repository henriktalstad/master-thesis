export type InfraspawnPointValueSource =
  | "influx-live"
  | "influx-stale"
  | "postgres-sync";

export function isInfluxLivePointSource(
  source: InfraspawnPointValueSource | undefined,
): source is "influx-live" {
  return source === "influx-live";
}

export function isInfluxSamplePointSource(
  source: InfraspawnPointValueSource | undefined,
): source is "influx-live" | "influx-stale" {
  return source === "influx-live" || source === "influx-stale";
}
