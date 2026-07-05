import { isEnergyMeterEquipmentCode } from "@/lib/infraspawn/equipment-code";
import type { EquipmentLanePolicy } from "./types";

function equipmentNumber(code: string): string {
  const match = code.toUpperCase().match(/(\d{2,4})$/);
  return match?.[1] ?? "";
}

export function equipmentCodeMatchesLane(
  equipmentCode: string,
  lane: EquipmentLanePolicy,
): boolean {
  const upper = equipmentCode.toUpperCase();
  const num = equipmentNumber(upper);

  switch (lane) {
    case "supply":
      return (
        /^(401|402|901)$/.test(num) ||
        /SAF|TILLUFT|SUPPLY/i.test(upper)
      );
    case "exhaust":
      return (
        /^(501|502)$/.test(num) ||
        /EAF|AVTREKK|EXTRACT/i.test(upper)
      );
    case "heat_recovery":
      return num === "471" || upper.startsWith("LX");
    case "heating":
      return (
        num === "550" ||
        upper.startsWith("JP") ||
        upper.startsWith("SB") ||
        isEnergyMeterEquipmentCode(upper)
      );
    case "status":
      return false;
    default:
      return false;
  }
}

export function prefixMatchesEquipmentCode(
  equipmentCode: string,
  prefix: string,
): boolean {
  return equipmentCode.toUpperCase().startsWith(prefix.toUpperCase());
}
