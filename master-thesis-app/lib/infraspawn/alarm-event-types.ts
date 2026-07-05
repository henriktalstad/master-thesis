import type {
  InfraspawnAlarmKind,
  InfraspawnAlarmSeverity,
  InfraspawnSystemDomain,
} from "@/generated/client/browser";

export type InfraspawnSeverityCounts = {
  a: number;
  b: number;
  c: number;
  fault: number;
};

export type InfraspawnAlarmEventListItem = {
  id: string;
  sourceId: string;
  objectId: string;
  kind: InfraspawnAlarmKind;
  severity: InfraspawnAlarmSeverity;
  alarmText: string;
  valueAtActivation: number | null;
  valueAtClear: number | null;
  activatedAt: string;
  clearedAt: string | null;
  domain: InfraspawnSystemDomain | null;
  sourceLabel: string | null;
  currentValue: number | null;
  unit: string | null;
  objectName: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
};

export type InfraspawnAlarmSummary = {
  activeCount: number;
  bySeverity: InfraspawnSeverityCounts;
  todayCounts: InfraspawnSeverityCounts;
  latestActive: InfraspawnAlarmEventListItem | null;
};
