import {
  escapeInfluxSqlString,
  influxSqlStringList,
} from "@/lib/infraspawn/influx-sql-literal";

export const INFLUX_BACNET_OBJECT_ID = '"objectId"';
export const INFLUX_BACNET_VALUE_NUM = "value_num";

export function buildInfluxBacnetLookbackClause(input: {
  lookbackMinutes?: number;
  lookbackHours?: number;
}): string {
  if (input.lookbackMinutes != null) {
    return `now() - INTERVAL '${input.lookbackMinutes} minutes'`;
  }
  if (input.lookbackHours != null) {
    return `now() - INTERVAL '${input.lookbackHours} hours'`;
  }
  throw new Error("Influx lookback krever lookbackMinutes eller lookbackHours");
}

export function buildInfluxBacnetObjectIdFilter(objectIds: string[]): string {
  if (objectIds.length === 0) return "";
  if (objectIds.length === 1) {
    return `AND ${INFLUX_BACNET_OBJECT_ID} = '${escapeInfluxSqlString(objectIds[0]!)}'`;
  }
  return `AND ${INFLUX_BACNET_OBJECT_ID} IN (${influxSqlStringList(objectIds)})`;
}

export function buildInfluxBacnetLiveQuery(input: {
  tableName: string;
  lookbackMinutes: number;
  objectIds: string[];
  order: "ASC" | "DESC";
  limit: number;
}): string {
  const objectFilter = buildInfluxBacnetObjectIdFilter(input.objectIds);
  return `SELECT * FROM ${input.tableName} WHERE time >= now() - INTERVAL '${input.lookbackMinutes} minutes' ${objectFilter} ORDER BY time ${input.order} LIMIT ${input.limit}`;
}

export function buildInfluxBacnetSingleLatestPointQuery(input: {
  tableName: string;
  objectId: string;
  lookbackHours?: number;
  lookbackMinutes?: number;
}): string {
  const objectFilter = buildInfluxBacnetObjectIdFilter([input.objectId]);
  return `SELECT * FROM ${input.tableName} WHERE time >= ${buildInfluxBacnetLookbackClause(input)} ${objectFilter} ORDER BY time DESC LIMIT 1`;
}

export function buildInfluxBacnetSelectorLastBatchQuery(input: {
  tableName: string;
  objectIds: string[];
  lookbackMinutes?: number;
  lookbackHours?: number;
}): string {
  const objectFilter = buildInfluxBacnetObjectIdFilter(input.objectIds);
  const lookback = buildInfluxBacnetLookbackClause(input);
  return `SELECT ${INFLUX_BACNET_OBJECT_ID}, selector_last(${INFLUX_BACNET_VALUE_NUM}, time)['time'] AS time, selector_last(${INFLUX_BACNET_VALUE_NUM}, time)['value'] AS ${INFLUX_BACNET_VALUE_NUM} FROM ${input.tableName} WHERE time >= ${lookback} ${objectFilter} GROUP BY ${INFLUX_BACNET_OBJECT_ID}`;
}
