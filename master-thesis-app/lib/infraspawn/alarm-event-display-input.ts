/** Klient-sikker input for alarmvisning — ikke importer read-alarm-events her. */
export type InfraspawnAlarmEventDisplayInput = {
  sourceId: string;
  objectId: string;
  alarmText: string;
  objectName?: string | null;
  description?: string | null;
  sourceLabel?: string | null;
};
