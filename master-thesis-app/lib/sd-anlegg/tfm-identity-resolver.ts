import {
  formatTfmElementKeyForDisplay,
  isSdAnleggsenhetElementKey,
  type InfraspawnSignalRole,
  type InfraspawnTfmIdentity,
} from "@/lib/infraspawn/parse-infraspawn-tfm-identity";
import { thermalAnleggsenhetDisplayLabel } from "@/lib/infraspawn/tfm-element-keys";
import { parseInfraspawnPointIdentity } from "@/lib/infraspawn/parse-infraspawn-point-identity";
import {
  inferInfraspawnSystemDomain,
  type InfraspawnSystemDomain,
} from "@/lib/infraspawn/system-domain";
import { resolveHumanInfraspawnPointLabel } from "@/lib/infraspawn/point-vocabulary";
import { subsystemRoleLabel } from "@/lib/infraspawn/tfm-subsystem-roles";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  SD_COMPONENT_REGISTRY,
  scoreSdComponentMatch,
} from "./component-registry";
import type { SdComponentType } from "./component-types";
import { resolveTfmPresentationLane } from "./resolve-tfm-presentation-lane";
import type { TemplateLane } from "./schema-templates/types";

export type TfmIdentityResolution = {
  identity: InfraspawnTfmIdentity | null;
  systemDomain: InfraspawnSystemDomain;
  anleggsenhetKey: string | null;
  componentType: SdComponentType | null;
  signalRole: InfraspawnSignalRole;
  lane: TemplateLane | null;
  displayLabel: string;
  technicalRef: string;
  confidence: "high" | "medium" | "low";
  rules: string[];
};

type PointInput = Pick<
  InfraspawnPointListItem,
  "objectId" | "objectName" | "description" | "unit" | "sourceLabel"
>;

function resolveComponentType(point: PointInput): SdComponentType | null {
  let best: SdComponentType | null = null;
  let bestScore = 0;
  for (const definition of SD_COMPONENT_REGISTRY) {
    const score = scoreSdComponentMatch(definition, point);
    if (score > bestScore) {
      bestScore = score;
      best = definition.type;
    }
  }
  return bestScore > 0 ? best : null;
}

function buildTechnicalRef(point: PointInput): string {
  const name = point.objectName?.trim();
  if (name && point.objectId) return `${name} · ${point.objectId}`;
  return name || point.objectId || "Ukjent signal";
}

export function resolveTfmIdentityForPoint(
  point: PointInput,
): TfmIdentityResolution {
  const rules: string[] = [];
  const identity = parseInfraspawnPointIdentity(point);

  if (identity) {
    rules.push(`tfm-parse:${identity.matchKind}`);
  } else {
    rules.push("tfm-parse:none");
  }

  const systemDomain = inferInfraspawnSystemDomain(point);
  rules.push(`domain:${systemDomain.toLowerCase()}`);

  const anleggsenhetKey =
    identity && isSdAnleggsenhetElementKey(identity.elementKey)
      ? identity.elementKey
      : null;
  if (anleggsenhetKey) {
    rules.push(`anleggsenhet:${anleggsenhetKey}`);
  }

  const signalRole = identity?.signalRole ?? "unknown";
  const componentType = resolveComponentType(point);
  if (componentType) {
    rules.push(`component:${componentType}`);
  }

  const lane = resolveTfmPresentationLane(
    systemDomain,
    identity,
    point,
    componentType,
    signalRole,
  );
  if (lane) {
    rules.push(`lane:${lane}`);
  }

  if (identity?.subsystemRole) {
    rules.push(`subsystem:${identity.subsystemRole}`);
  }

  let displayLabel =
    resolveHumanInfraspawnPointLabel(point) ?? buildTechnicalRef(point);
  if (identity?.subsystemRole) {
    const roleLabel = subsystemRoleLabel(identity.subsystemRole);
    if (
      roleLabel &&
      !displayLabel.toLowerCase().includes(roleLabel.toLowerCase())
    ) {
      displayLabel = `${displayLabel} (${roleLabel})`;
    }
  }

  const confidence = identity?.confidence ?? "low";

  return {
    identity,
    systemDomain,
    anleggsenhetKey,
    componentType,
    signalRole,
    lane,
    displayLabel,
    technicalRef: buildTechnicalRef(point),
    confidence,
    rules,
  };
}

export function formatAnleggsenhetDisplayFromTfmKey(
  unitKey: string,
  sourceLabel: string,
): string {
  const roleLabel = thermalAnleggsenhetDisplayLabel(unitKey);
  const formatted = formatTfmElementKeyForDisplay(unitKey);
  const normalizedSource = unitKey.replace(/[.\s]/g, "").toLowerCase();
  const sourceNorm = sourceLabel.replace(/[.\s]/g, "").toLowerCase();

  if (
    sourceNorm.includes(normalizedSource) ||
    sourceLabel.includes(formatted)
  ) {
    return sourceLabel.trim() || formatted;
  }
  if (roleLabel) {
    return `${formatted} · ${roleLabel}`;
  }
  return `${formatted} · ${sourceLabel.trim() || "Anlegg"}`;
}
