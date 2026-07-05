import type { InfraspawnAlarmPointGroup } from "@/lib/infraspawn/group-alarm-events";

export type PartitionedAlarmGroups = {
  activeGroups: InfraspawnAlarmPointGroup[];
  historyGroups: InfraspawnAlarmPointGroup[];
};

export function partitionAlarmPointGroups(
  groups: readonly InfraspawnAlarmPointGroup[],
): PartitionedAlarmGroups {
  const activeGroups: InfraspawnAlarmPointGroup[] = [];
  const historyGroups: InfraspawnAlarmPointGroup[] = [];

  for (const group of groups) {
    if (group.activeEvent != null) {
      activeGroups.push(group);
    } else {
      historyGroups.push(group);
    }
  }

  return { activeGroups, historyGroups };
}
