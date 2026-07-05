import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { formatInfraspawnPointValue } from "@/lib/infraspawn/display-format";
import type { TemplateNodeDef } from "./schema-templates/types";

export type SchematicAlarmItem = {
  id: string;
  label: string;
  active: boolean;
  point?: InfraspawnPointListItem;
};

export type SchematicAlarmHistoryTarget = {
  code: string;
  roleLabel: string;
  primaryPoint: InfraspawnPointListItem;
  relatedPoints: InfraspawnPointListItem[];
  displayValue: string | null;
  stateLabel?: string | null;
};

const SCHEMATIC_ALARM_DEFINITIONS = [
  {
    id: "fire",
    labels: [
      "SMOKEDETECTORALARM",
      "360102_RY401_A",
      "360102_BRANNALARM",
      "FIREALARM",
    ],
    label: "Brannalarm",
    exact: false,
  },
  {
    id: "sum",
    labels: ["SUMALARM", "360102_SUMALARM"],
    label: "Sumalarm",
    exact: true,
  },
  {
    id: "sum_a",
    labels: ["SUMALARMA", "360102_SUMALARMA"],
    label: "A-Alarm",
    exact: true,
  },
  {
    id: "sum_b",
    labels: ["SUMALARMB", "360102_SUMALARMB"],
    label: "B-Alarm",
    exact: true,
  },
  {
    id: "sum_c",
    labels: ["SUMALARMC", "360102_SUMALARMC"],
    label: "C-Alarm",
    exact: true,
  },
] as const;

export function buildAhuSchematicAlarmTemplateNodes(): TemplateNodeDef[] {
  return SCHEMATIC_ALARM_DEFINITIONS.map((definition) => ({
    id: `alarm.${definition.id}`,
    role: `alarm.${definition.id}`,
    lane: "status",
    componentType: "binary.status",
    label: definition.label,
    bind: {
      kind: "namedSignal",
      patterns: definition.labels,
      allowCrossElement: true,
    },
  }));
}

function normalizePointName(point: InfraspawnPointListItem): string {
  return (point.objectName ?? point.objectId ?? "").trim().toUpperCase();
}

export function isSchematicBinaryAlarmActive(point: InfraspawnPointListItem): boolean {
  if (point.statusInAlarm) return true;
  const value = point.lastValue;
  if (value == null || Number.isNaN(value)) return false;
  return value >= 0.95;
}

function findAlarmPoint(
  points: readonly InfraspawnPointListItem[],
  labels: readonly string[],
  exact: boolean,
): InfraspawnPointListItem | undefined {
  const wanted = labels.map((label) => label.toUpperCase());

  for (const label of wanted) {
    const found = points.find((point) => {
      const name = normalizePointName(point);
      if (exact) return name === label;
      return name === label || name.includes(label);
    });
    if (found) return found;
  }

  return undefined;
}

export function isAhuSchematicAlarmPoint(
  point: Pick<InfraspawnPointListItem, "objectName" | "objectId">,
): boolean {
  const name = normalizePointName(point as InfraspawnPointListItem);
  if (!name) return false;

  for (const definition of SCHEMATIC_ALARM_DEFINITIONS) {
    if (findAlarmPoint([point as InfraspawnPointListItem], definition.labels, definition.exact)) {
      return true;
    }
  }

  return false;
}

function collectRelatedAlarmPoints(
  item: SchematicAlarmItem,
  points: readonly InfraspawnPointListItem[],
): InfraspawnPointListItem[] {
  const definition = SCHEMATIC_ALARM_DEFINITIONS.find((entry) => entry.id === item.id);
  if (!definition) {
    return item.point ? [item.point] : [];
  }

  const seen = new Set<string>();
  const related: InfraspawnPointListItem[] = [];

  for (const label of definition.labels) {
    for (const point of points) {
      const name = normalizePointName(point);
      const wanted = label.toUpperCase();
      const matches = definition.exact
        ? name === wanted
        : name === wanted || name.includes(wanted);
      if (!matches) continue;
      const key = `${point.sourceId}:${point.objectId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      related.push(point);
    }
  }

  return related;
}

export function resolveAhuSchematicAlarms(
  points: readonly InfraspawnPointListItem[],
): SchematicAlarmItem[] {
  return SCHEMATIC_ALARM_DEFINITIONS.map((definition) => {
    const point = findAlarmPoint(points, definition.labels, definition.exact);
    return {
      id: definition.id,
      label: definition.label,
      active: point ? isSchematicBinaryAlarmActive(point) : false,
      point,
    };
  });
}

export function resolveHxLowEfficiencyAlarm(
  points: readonly InfraspawnPointListItem[],
): { active: boolean; point?: InfraspawnPointListItem } {
  const point = points.find((entry) => {
    const name = normalizePointName(entry);
    return name === "LOWEFFICIENCY" || name.includes("LX471_KV_LOW");
  });

  return {
    active: point ? isSchematicBinaryAlarmActive(point) : false,
    point,
  };
}

export function buildSchematicAlarmHistoryTarget(
  item: SchematicAlarmItem,
  points: readonly InfraspawnPointListItem[] = [],
): SchematicAlarmHistoryTarget | null {
  if (!item.point) return null;

  const relatedPoints = collectRelatedAlarmPoints(item, points);
  const primaryPoint = item.point;

  return {
    code: item.label,
    roleLabel: "Alarmstatus",
    primaryPoint,
    relatedPoints: relatedPoints.length > 0 ? relatedPoints : [primaryPoint],
    displayValue: formatInfraspawnPointValue(
      primaryPoint.lastValue,
      primaryPoint.unit,
      primaryPoint,
    ),
    stateLabel: item.active ? "Aktiv alarm" : "Normal",
  };
}

export function buildLowEfficiencyHistoryTarget(alarm: {
  active: boolean;
  point?: InfraspawnPointListItem;
}): SchematicAlarmHistoryTarget | null {
  if (!alarm.point) return null;

  return {
    code: "LX471",
    roleLabel: "Varmegjenvinner",
    primaryPoint: alarm.point,
    relatedPoints: [alarm.point],
    displayValue: formatInfraspawnPointValue(
      alarm.point.lastValue,
      alarm.point.unit,
      alarm.point,
    ),
    stateLabel: alarm.active ? "Virkningsgradsalarm lav" : "Normal",
  };
}
