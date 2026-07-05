import type { InfraspawnAlarmKind } from "@/generated/client";
import { InfraspawnAlarmKind as InfraspawnAlarmKindEnum } from "@/generated/client/enums";
import { parseInfraspawnPointStatusMetadata } from "@/lib/infraspawn/point-metadata";

export type PointAlarmState = {
  alarm: boolean;
  fault: boolean;
  outOfService: boolean;
};

const ALARM_KIND_TRANSITIONS: {
  kind: InfraspawnAlarmKind;
  isActive: (state: PointAlarmState) => boolean;
}[] = [
  {
    kind: InfraspawnAlarmKindEnum.OUT_OF_SERVICE,
    isActive: (state) => state.outOfService,
  },
  {
    kind: InfraspawnAlarmKindEnum.FAULT,
    isActive: (state) => state.fault,
  },
  {
    kind: InfraspawnAlarmKindEnum.ALARM,
    isActive: (state) => state.alarm,
  },
];

function activeKinds(state: PointAlarmState): InfraspawnAlarmKind[] {
  return ALARM_KIND_TRANSITIONS.filter(({ isActive }) => isActive(state)).map(
    ({ kind }) => kind,
  );
}

export function extractPointAlarmStateFromRawMetadata(
  raw: unknown,
): PointAlarmState {
  const metadata = parseInfraspawnPointStatusMetadata(raw);
  return {
    alarm: metadata?.status_inAlarm ?? false,
    fault: metadata?.status_fault ?? false,
    outOfService: metadata?.status_outOfService ?? false,
  };
}

export function diffAlarmKinds(
  previous: PointAlarmState,
  next: PointAlarmState,
): {
  activated: InfraspawnAlarmKind[];
  cleared: InfraspawnAlarmKind[];
} {
  const prevKinds = new Set(activeKinds(previous));
  const nextKinds = new Set(activeKinds(next));
  return {
    activated: Array.from(nextKinds).filter((kind) => !prevKinds.has(kind)),
    cleared: Array.from(prevKinds).filter((kind) => !nextKinds.has(kind)),
  };
}

export function isAlarmKindActiveInState(
  state: PointAlarmState,
  kind: InfraspawnAlarmKind,
): boolean {
  return activeKinds(state).includes(kind);
}
