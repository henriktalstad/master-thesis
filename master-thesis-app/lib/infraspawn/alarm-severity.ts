import type { InfraspawnAlarmKind, InfraspawnAlarmSeverity } from "@/generated/client";
import { InfraspawnAlarmKind as InfraspawnAlarmKindEnum } from "@/generated/client/enums";
import { infraspawnPointHaystack } from "@/lib/infraspawn/point-haystack";

type SeverityInput = {
  objectId: string;
  objectName?: string | null;
  description?: string | null;
  unit?: string | null;
  kind: InfraspawnAlarmKind;
};

export function inferInfraspawnAlarmSeverity(
  input: SeverityInput,
): InfraspawnAlarmSeverity {
  if (
    input.kind === InfraspawnAlarmKindEnum.FAULT ||
    input.kind === InfraspawnAlarmKindEnum.OUT_OF_SERVICE
  ) {
    return "FAULT";
  }

  const haystack = infraspawnPointHaystack({
    objectId: input.objectId,
    objectName: input.objectName ?? null,
    description: input.description ?? null,
    unit: input.unit ?? null,
  }).toLowerCase();

  if (/brann|brannsentral|smoke|fire|sprinkler/.test(haystack)) {
    return "A";
  }

  if (
    /romtemp|rom.?temp|temperatur|differansetrykk|trykk|co2|fukt|rh|analog/.test(
      haystack,
    )
  ) {
    return "B";
  }

  if (/sumalarm|aggregert|sum.?alarm/.test(haystack)) {
    return "C";
  }

  return "B";
}

export const INFRASPAWN_ALARM_SEVERITY_LABELS: Record<
  InfraspawnAlarmSeverity,
  string
> = {
  A: "A",
  B: "B",
  C: "C",
  FAULT: "Feil",
};
