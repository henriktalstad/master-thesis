export function escapeInfluxSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

export function influxSqlStringList(values: string[]): string {
  return values.map((v) => `'${escapeInfluxSqlString(v)}'`).join(", ");
}
