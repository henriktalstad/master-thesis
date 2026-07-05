import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

const INFRASPAWN_POINT_STUB_DEFAULTS: Omit<
  InfraspawnPointListItem,
  "sourceId" | "objectId"
> = {
  sourceLabel: "",
  objectName: null,
  description: null,
  unit: null,
  lastValue: null,
  lastSampledAt: null,
  valueSource: "postgres-sync",
  quality: null,
  statusFault: false,
  statusInAlarm: false,
  statusOutOfService: false,
  statusOverridden: false,
};

export function buildInfraspawnPointStub(
  partial: Pick<InfraspawnPointListItem, "sourceId" | "objectId"> &
    Partial<Omit<InfraspawnPointListItem, "sourceId" | "objectId">>,
): InfraspawnPointListItem {
  return { ...INFRASPAWN_POINT_STUB_DEFAULTS, ...partial };
}
