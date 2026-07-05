import "server-only";

import { InfraspawnAlarmKind } from "@/generated/client/enums";
import { insertOpenInfraspawnAlarmIfAbsent } from "@/lib/infraspawn/insert-open-alarm-if-absent";
import { inferInfraspawnAlarmSeverity } from "@/lib/infraspawn/alarm-severity";
import { formatInfraspawnPointLabel } from "@/lib/infraspawn/display-format";
import { loadLivePointsForBuilding } from "@/lib/infraspawn/load-live-building-points";
import { isInfraspawnActiveAlarmPoint } from "@/lib/infraspawn/point-status";
import { inferInfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";

export async function bootstrapInfraspawnOpenAlarmsForBuilding(input: {
  integrationId: string;
  buildingId: string;
}): Promise<number> {
  const livePoints = await loadLivePointsForBuilding({
    integrationId: input.integrationId,
    buildingId: input.buildingId,
    liveLoadProfile: "poll",
    includeInfluxTail: true,
  });

  let created = 0;

  for (const point of livePoints) {
    if (!isInfraspawnActiveAlarmPoint(point)) continue;

    const kind = point.statusFault
      ? InfraspawnAlarmKind.FAULT
      : InfraspawnAlarmKind.ALARM;

    const activatedAt = point.lastSampledAt
      ? new Date(point.lastSampledAt)
      : new Date();

    const inserted = await insertOpenInfraspawnAlarmIfAbsent({
      sourceId: point.sourceId,
      objectId: point.objectId,
      buildingId: input.buildingId,
      kind,
      severity: inferInfraspawnAlarmSeverity({
        objectId: point.objectId,
        objectName: point.objectName,
        description: point.description,
        unit: point.unit,
        kind,
      }),
      alarmText:
        point.objectName?.trim() ||
        formatInfraspawnPointLabel(point),
      valueAtActivation: point.lastValue ?? null,
      activatedAt,
      domain: inferInfraspawnSystemDomain(point),
      metadata: {
        unit: point.unit ?? null,
        quality: point.quality ?? null,
        bootstrapped: true,
      },
    });
    if (inserted) {
      created += 1;
    }
  }

  return created;
}
