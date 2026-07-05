export const DEFAULT_INFLUX_TABLE = "bacnet_point";

const TABLE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export function resolveInfluxTableNameFromInput(tableName?: string): string {
  const table = tableName?.trim();
  if (table && TABLE_NAME_PATTERN.test(table)) return table;
  return DEFAULT_INFLUX_TABLE;
}

export function resolveInfluxTableName(metadata?: unknown): string {
  if (!metadata || typeof metadata !== "object") return DEFAULT_INFLUX_TABLE;
  const table = (metadata as { tableName?: string }).tableName;
  return resolveInfluxTableNameFromInput(table);
}
