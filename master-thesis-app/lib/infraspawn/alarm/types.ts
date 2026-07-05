import type {
  InfraspawnAlarmKind,
  InfraspawnAlarmSeverity,
  InfraspawnSystemDomain,
} from "@/generated/client/enums";
import type { Prisma } from "@/generated/client";

export type OpenInfraspawnAlarmInsert = {
  sourceId: string;
  objectId: string;
  buildingId: string;
  kind: InfraspawnAlarmKind;
  severity: InfraspawnAlarmSeverity;
  alarmText: string;
  valueAtActivation: number | null;
  activatedAt: Date;
  domain: InfraspawnSystemDomain;
  metadata?: Prisma.InputJsonValue;
};

export type OpenAlarmRecord = {
  id: string;
  objectId: string;
  kind: InfraspawnAlarmKind;
  activatedAt: Date;
  openDedupeKey: string | null;
};

export type CloseAlarmBatch = {
  eventIds: string[];
  clearedAt: Date;
  valueAtClear: number | null;
};
