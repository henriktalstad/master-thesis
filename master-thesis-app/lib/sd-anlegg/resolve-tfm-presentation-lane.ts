import { infraspawnPointHaystack } from "@/lib/infraspawn/point-haystack";
import type { InfraspawnSignalRole } from "@/lib/infraspawn/parse-infraspawn-tfm-identity";
import type { InfraspawnTfmIdentity } from "@/lib/infraspawn/parse-infraspawn-tfm-identity";
import type { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import type { SdComponentType } from "./component-types";
import type { TemplateLane } from "./schema-templates/types";

type LanePointInput = {
  objectId: string;
  objectName?: string | null;
  description?: string | null;
  unit?: string | null;
};

export function resolveTfmPresentationLane(
  domain: InfraspawnSystemDomain,
  identity: InfraspawnTfmIdentity | null,
  point: LanePointInput,
  componentType: SdComponentType | null,
  signalRole: InfraspawnSignalRole,
): TemplateLane | null {
  if (signalRole === "setpoint" || signalRole === "status") {
    return "status";
  }

  if (identity?.subsystemRole) {
    switch (identity.subsystemRole) {
      case "supply_air":
      case "intake":
        return "supply";
      case "extract_air":
      case "special_extract":
      case "exhaust_outlet":
        return "exhaust";
      case "supply_water":
      case "return_water":
        return "heating";
      default:
        break;
    }
  }

  if (componentType?.startsWith("ventilation.")) {
    if (componentType === "ventilation.heat_recovery") return "heat_recovery";
    const haystack = infraspawnPointHaystack({
      objectId: point.objectId,
      objectName: point.objectName ?? null,
      description: point.description ?? null,
      unit: point.unit ?? null,
    }).toLowerCase();
    if (/exhaust|avtrekk|eaf|401|502|901/.test(haystack)) return "exhaust";
    return "supply";
  }

  if (
    componentType?.startsWith("hvac.") ||
    componentType?.startsWith("sensor.") ||
    domain === "HEATING"
  ) {
    if (
      signalRole === "power" ||
      signalRole === "energy" ||
      signalRole === "flow"
    ) {
      return "heating";
    }
    if (componentType?.startsWith("sensor.")) {
      return domain === "HEATING" ? "heating" : "supply";
    }
    return "heating";
  }

  return null;
}
