import { infraspawnPointHaystack } from "@/lib/infraspawn/point-haystack";
import { extractInfraspawnEquipmentCodes } from "@/lib/infraspawn/parse-point-ks-tag";
import { parseInfraspawnPointIdentity } from "@/lib/infraspawn/parse-infraspawn-point-identity";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  equipmentCodeMatchesLane,
  prefixMatchesEquipmentCode,
} from "./equipment-lane-policy";
import type { BindingRule } from "./types";

function normalizeToken(value: string): string {
  return value.trim().toUpperCase();
}

/** Boligdel (320.002) leser OE001 fra primær 320.001 — næring bruker egen 320003OE001. */
function resolveOeMeterPrefixForElementKey(elementKey: string): string | null {
  switch (elementKey) {
    case "320002":
      return "320001";
    case "320003":
      return "320003";
    case "320001":
      return "320001";
    default:
      return elementKey.startsWith("320") ? elementKey : null;
  }
}

function oeSuffixMatchesElementKey(
  objectName: string,
  elementKey: string,
): boolean {
  const oePrefix = resolveOeMeterPrefixForElementKey(elementKey);
  if (!oePrefix) return true;
  const lower = objectName.toLowerCase();
  const needle = `${oePrefix.toLowerCase()}oe`;
  if (lower.startsWith(needle)) return true;
  if (!/oe001/i.test(objectName)) return true;
  return false;
}

function scoreNamedPattern(haystack: string, pattern: string): number {
  const needle = normalizeToken(pattern).toLowerCase();
  if (!needle) return 0;
  if (haystack.includes(needle)) return 80;
  return 0;
}

export function scoreBindingRuleMatch(
  point: InfraspawnPointListItem,
  rule: BindingRule,
  elementKey?: string | null,
): number {
  const haystack = infraspawnPointHaystack(point).toLowerCase();
  const identity = parseInfraspawnPointIdentity(point);
  const pointElementKey = identity?.elementKey ?? null;

  const skipElementKey =
    (rule.kind === "namedSignal" && rule.allowCrossElement === true) ||
    (rule.kind === "equipmentDigits" && rule.allowCrossElement === true) ||
    (rule.kind === "oeSuffix" && rule.allowCrossElement === true);

  if (
    elementKey &&
    !skipElementKey &&
    pointElementKey &&
    pointElementKey !== elementKey
  ) {
    return 0;
  }

  switch (rule.kind) {
    case "anyOf": {
      let best = 0;
      for (const subRule of rule.rules) {
        best = Math.max(best, scoreBindingRuleMatch(point, subRule, elementKey));
      }
      return best;
    }
    case "equipmentCode": {
      const codes = extractInfraspawnEquipmentCodes(point);
      let best = 0;
      for (const code of codes) {
        if (!prefixMatchesEquipmentCode(code, rule.prefix)) continue;
        if (!equipmentCodeMatchesLane(code, rule.lane)) continue;
        best = Math.max(best, 95);
      }
      if (best > 0) return best;
      const prefixNeedle = rule.prefix.toLowerCase();
      if (haystack.includes(prefixNeedle)) {
        for (const code of codes) {
          if (prefixMatchesEquipmentCode(code, rule.prefix)) {
            return 70;
          }
        }
      }
      return 0;
    }
    case "equipmentDigits": {
      const codes = extractInfraspawnEquipmentCodes(point);
      for (const code of codes) {
        if (
          prefixMatchesEquipmentCode(code, rule.prefix) &&
          equipmentNumber(code) === rule.digits
        ) {
          return 100;
        }
      }
      const compact = `${rule.prefix}${rule.digits}`.toLowerCase();
      return haystack.includes(compact) ? 85 : 0;
    }
    case "signalRole": {
      if (
        identity?.signalRole === "setpoint" &&
        rule.suffix.toUpperCase() === "SP"
      ) {
        if (
          prefixMatchesEquipmentCode(
            identity.equipmentCode ?? "",
            rule.equipmentPrefix,
          )
        ) {
          return 100;
        }
      }
      if (!identity?.equipmentCode) {
        const objectName = point.objectName?.toUpperCase() ?? "";
        if (
          objectName.includes(`${rule.equipmentPrefix}${rule.suffix}`) ||
          objectName.endsWith(`_${rule.suffix}`)
        ) {
          return 75;
        }
        return scoreNamedPattern(haystack, `${rule.equipmentPrefix}_${rule.suffix}`);
      }
      if (
        !prefixMatchesEquipmentCode(identity.equipmentCode, rule.equipmentPrefix)
      ) {
        return 0;
      }
      const suffix = identity.signalSuffix?.toUpperCase() ?? "";
      if (suffix === rule.suffix.toUpperCase()) return 100;
      if (haystack.includes(`_${rule.suffix.toLowerCase()}`)) return 90;
      return 0;
    }
    case "oeSuffix": {
      const rawName = point.objectName ?? "";
      const objectName = rawName.toLowerCase();
      const suffix = rule.suffix.toLowerCase();
      let score = 0;
      if (objectName.endsWith(`_${suffix}`)) score = 95;
      else if (objectName.includes(suffix)) score = 80;
      else return 0;

      if (elementKey && !oeSuffixMatchesElementKey(rawName, elementKey)) {
        return 0;
      }
      return score;
    }
    case "namedSignal": {
      let best = 0;
      for (let i = 0; i < rule.patterns.length; i++) {
        const pattern = rule.patterns[i]!;
        const rank = i;
        best = Math.max(best, scoreNamedPattern(haystack, pattern) - rank);
        const objectName = normalizeToken(point.objectName ?? "");
        const objectId = normalizeToken(point.objectId);
        if (objectName === normalizeToken(pattern)) {
          best = Math.max(best, 100 - rank);
        }
        if (objectName.endsWith(normalizeToken(pattern))) {
          best = Math.max(best, 95 - rank);
        }
        if (objectId.includes(normalizeToken(pattern))) {
          best = Math.max(best, 60 - rank);
        }
      }
      return best;
    }
    default:
      return 0;
  }
}

function equipmentNumber(code: string): string {
  const match = code.toUpperCase().match(/(\d{2,4})$/);
  return match?.[1] ?? "";
}

export function findBestBindingRuleMatch(
  points: readonly InfraspawnPointListItem[],
  rule: BindingRule,
  elementKey?: string | null,
): InfraspawnPointListItem | null {
  let best: InfraspawnPointListItem | null = null;
  let bestScore = 0;

  for (const point of points) {
    const score = scoreBindingRuleMatch(point, rule, elementKey);
    if (score > bestScore) {
      bestScore = score;
      best = point;
    }
  }

  return bestScore > 0 ? best : null;
}
