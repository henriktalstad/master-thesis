import { infraspawnPointHaystack } from "@/lib/infraspawn/point-haystack";
import { extractInfraspawnEquipmentCodes } from "@/lib/infraspawn/parse-point-ks-tag";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdComponentType } from "./component-types";
import {
  resolveAhuBlueprintEquipmentCodes,
  type AhuBlueprintSlotDef,
  type AhuLabelPosition,
  type AhuLane,
  type AhuSlotRole,
  type AhuStatusSlotDef,
} from "./ahu-blueprint";
import {
  AHU_SIGNAL_ALIAS_TO_SLOT,
  compactAliasToken,
  resolveAhuSignalAliasSlotIdForPoint,
} from "./ahu-signal-alias-registry";
import { isAhuBindablePoint } from "./ahu-point-eligibility";
import {
  buildProcessSlotDisplayLines,
  formatStatusStripeValue,
  resolveProcessPrimaryDisplay,
  slotHasChartAffordance,
  type SlotDisplayLine,
} from "./format-process-slot-display";
import { isAoValveCommandSignal } from "./valve-command-percent";
import { scoreBindingRuleMatch } from "./schema-templates/match-binding-rule";
import { resolveAhuBlueprintOrDefault } from "./schema-templates/resolve-ahu-blueprint";
import { VENTILATION_AHU_DUAL_DUCT_HRU } from "./schema-templates/templates/ventilation.ahu.dual_duct_hru";
import type { TemplateNodeDef } from "./schema-templates/types";
import { isInfraspawnSetpointSignal } from "./scope-workspace-points";
import { parseInfraspawnPointIdentity } from "@/lib/infraspawn/parse-infraspawn-point-identity";

const AHU_SLOT_TEMPLATE_NODE_ID: Partial<Record<string, string>> = {
  "supply.filter": "supply.filter",
  "exhaust.filter": "exhaust.filter",
  "supply.temp_out": "supply.temp",
};

const TEMPLATE_NODE_BY_ID = new Map(
  VENTILATION_AHU_DUAL_DUCT_HRU.nodes.map((node) => [node.id, node] as const),
);

export type BuildAhuPresentationModelOptions = {
  /** Filtrer kompakte utstyrstagger til valgt anleggsenhet (f.eks. `360102`). */
  elementKey?: string | null;
  /** Eksplisitt slot-binding fra pointMetadataOverrides (pointKey → slotId). */
  schemaSlotOverrides?: ReadonlyMap<string, string>;
  /** Schema-mal styrer blueprint-topologi (f.eks. `ventilation.ahu.dual_duct_hru`). */
  templateId?: string | null;
};

export type AhuIdentityConfidence = "exact" | "alias" | "inferred" | "missing";

export type AhuEquipmentSlot = {
  slotId: string;
  equipmentCode: string;
  role: AhuSlotRole;
  lane: AhuLane;
  componentType: SdComponentType;
  label?: string;
  x: number;
  y: number;
  labelPosition: AhuLabelPosition;
  primaryPoint?: InfraspawnPointListItem;
  relatedPoints: InfraspawnPointListItem[];
  displayLines: SlotDisplayLine[];
  displayValue: string | null;
  stateLabel: string | null;
  chartAffordance: boolean;
  confidence: AhuIdentityConfidence;
  alarm: boolean;
  fault: boolean;
};

export type AhuStatusSlot = {
  slotId: string;
  label: string;
  order: number;
  primaryPoint?: InfraspawnPointListItem;
  relatedPoints: InfraspawnPointListItem[];
  displayValue: string | null;
  confidence: AhuIdentityConfidence;
  alarm: boolean;
};

export type AhuIdentificationSummary = {
  exact: number;
  alias: number;
  inferred: number;
  missing: number;
  total: number;
  coveragePct: number;
};

export type AhuPresentationModel = {
  processSlots: AhuEquipmentSlot[];
  statusSlots: AhuStatusSlot[];
  summary: AhuIdentificationSummary;
};

type SlotBindingCandidate = {
  slotId: string;
  point: InfraspawnPointListItem;
  score: number;
  confidence: AhuIdentityConfidence;
};

function normalizeToken(value: string): string {
  return value.trim().toUpperCase();
}

function pointKey(point: InfraspawnPointListItem): string {
  return `${point.sourceId}:${point.objectId}`;
}

function pointHaystack(point: InfraspawnPointListItem): string {
  return infraspawnPointHaystack(point).toUpperCase();
}

function pointObjectName(point: InfraspawnPointListItem): string {
  return normalizeToken(point.objectName ?? point.objectId);
}

function scoreExactEquipmentMatch(
  point: InfraspawnPointListItem,
  codes: readonly string[],
): number {
  const extracted = extractInfraspawnEquipmentCodes(point);
  let best = 0;
  for (const code of codes) {
    const upper = normalizeToken(code);
    if (extracted.some((entry) => entry === upper)) return 100;
    const name = pointObjectName(point);
    if (name === upper || name.endsWith(upper)) best = Math.max(best, 95);
    if (name.includes(upper)) best = Math.max(best, 85);
  }
  return best;
}

function pointSuitableForProcessSlot(
  point: InfraspawnPointListItem,
  def: AhuBlueprintSlotDef,
): boolean {
  const name = pointObjectName(point);
  const unit = (point.unit ?? "").toLowerCase();

  if (def.role === "pump") {
    if (unit.includes("volt")) return false;
    if (/^JP\d+$/.test(name) && !/KMD|_S|SEQ|SELECT/.test(name)) {
      return false;
    }
  }

  if (def.role === "valve" && name === "AO_4") {
    return false;
  }

  if (def.role === "valve" || def.role === "coil") {
    if (isAoValveCommandSignal(point)) return true;
    if (unit.includes("volt")) return false;
  }

  if (def.role !== "temp") return true;
  if (def.slotId === "supply.temp_mid" || def.slotId === "exhaust.temp_mid") {
    if (isInfraspawnSetpointSignal(point)) return false;
    const identity = parseInfraspawnPointIdentity(point);
    if (
      identity?.signalRole === "setpoint" ||
      identity?.signalSuffix?.toUpperCase() === "SP"
    ) {
      return false;
    }
  }
  return true;
}

function resolveTemplateNodeForSlot(
  slotId: string,
): TemplateNodeDef | undefined {
  const templateNodeId = AHU_SLOT_TEMPLATE_NODE_ID[slotId] ?? slotId;
  return TEMPLATE_NODE_BY_ID.get(templateNodeId);
}

function scoreTemplateBinding(
  point: InfraspawnPointListItem,
  slotId: string,
  elementKey?: string | null,
): number {
  const node = resolveTemplateNodeForSlot(slotId);
  if (!node) return 0;
  return scoreBindingRuleMatch(point, node.bind, elementKey);
}

function scoreAliasMatch(
  point: InfraspawnPointListItem,
  slotId: string,
): number {
  const name = pointObjectName(point);
  const resolved = resolveAhuSignalAliasSlotIdForPoint(point);
  if (resolved === slotId) return 90;

  const compactName = compactAliasToken(name);
  for (const [pattern, targetSlotId] of Object.entries(AHU_SIGNAL_ALIAS_TO_SLOT)) {
    if (targetSlotId !== slotId) continue;
    if (compactAliasToken(pattern) === compactName) return 90;
  }

  const hay = pointHaystack(point);
  for (const [pattern, targetSlotId] of Object.entries(AHU_SIGNAL_ALIAS_TO_SLOT)) {
    if (targetSlotId !== slotId) continue;
    const needle = pattern.toLowerCase();
    if (hay.includes(needle)) return 80;
    if (name.includes(pattern)) return 85;
  }

  return 0;
}

function scoreStatusMatch(
  point: InfraspawnPointListItem,
  patterns: readonly string[],
): number {
  const hay = pointHaystack(point).toLowerCase();
  const name = (point.objectName ?? "").toLowerCase();
  let best = 0;
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i]!;
    const needle = pattern.toLowerCase();
    const rank = i;
    if (name === needle) best = Math.max(best, 100 - rank);
    else if (name.includes(needle)) best = Math.max(best, 95 - rank);
    else if (hay.includes(needle)) best = Math.max(best, 80 - rank);
  }
  if (best > 0 && name.includes("frostprottemp")) {
    best = Math.min(best, 75);
  }
  return best;
}

function scorePointForSlot(
  point: InfraspawnPointListItem,
  def: AhuBlueprintSlotDef,
  codes: readonly string[],
  elementKey?: string | null,
): { score: number; confidence: AhuIdentityConfidence } | null {
  const exactScore = scoreExactEquipmentMatch(point, codes);
  if (exactScore > 0) {
    return { score: exactScore, confidence: "exact" };
  }

  const aliasScore = scoreAliasMatch(point, def.slotId);
  if (aliasScore > 0) {
    return { score: aliasScore, confidence: "alias" };
  }

  const templateScore = scoreTemplateBinding(point, def.slotId, elementKey);
  if (templateScore >= 80) {
    return { score: templateScore, confidence: "alias" };
  }

  return null;
}

function compareBindingCandidates(
  a: SlotBindingCandidate,
  b: SlotBindingCandidate,
): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.confidence === "exact" && b.confidence !== "exact") return -1;
  if (b.confidence === "exact" && a.confidence !== "exact") return 1;
  return 0;
}

function assignPrimarySlotsGlobally(
  candidates: readonly SlotBindingCandidate[],
): Map<string, SlotBindingCandidate> {
  const sorted = [...candidates].sort(compareBindingCandidates);
  const assignedPoints = new Set<string>();
  const slotPrimary = new Map<string, SlotBindingCandidate>();

  for (const candidate of sorted) {
    const key = pointKey(candidate.point);
    if (assignedPoints.has(key)) continue;
    if (slotPrimary.has(candidate.slotId)) continue;

    slotPrimary.set(candidate.slotId, candidate);
    assignedPoints.add(key);
  }

  return slotPrimary;
}

function pickBestPoint(
  candidates: Array<{
    point: InfraspawnPointListItem;
    score: number;
    confidence: AhuIdentityConfidence;
  }>,
): {
  primary?: InfraspawnPointListItem;
  related: InfraspawnPointListItem[];
  confidence: AhuIdentityConfidence;
} {
  if (candidates.length === 0) {
    return { related: [], confidence: "missing" };
  }

  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.confidence === "exact" && b.confidence !== "exact") return -1;
    if (b.confidence === "exact" && a.confidence !== "exact") return 1;
    return 0;
  });
  const primary = sorted[0]!.point;
  const confidence = sorted[0]!.confidence;
  const related = sorted.map((entry) => entry.point);
  return { primary, related, confidence };
}

function collectProcessSlotCandidates(
  def: AhuBlueprintSlotDef,
  points: readonly InfraspawnPointListItem[],
  pointToSlot: ReadonlyMap<string, string>,
  elementKey?: string | null,
): Array<{
  point: InfraspawnPointListItem;
  score: number;
  confidence: AhuIdentityConfidence;
}> {
  const codes = resolveAhuBlueprintEquipmentCodes(def);
  const candidates: Array<{
    point: InfraspawnPointListItem;
    score: number;
    confidence: AhuIdentityConfidence;
  }> = [];

  for (const point of points) {
    if (!isAhuBindablePoint(point, elementKey)) continue;
    if (!pointSuitableForProcessSlot(point, def)) continue;

    const key = pointKey(point);
    const assignedSlot = pointToSlot.get(key);
    if (assignedSlot && assignedSlot !== def.slotId) continue;

    const match = scorePointForSlot(point, def, codes, elementKey);
    if (match) {
      candidates.push({ point, ...match });
    }
  }

  return candidates;
}

function materializeProcessSlot(
  def: AhuBlueprintSlotDef,
  picked: ReturnType<typeof pickBestPoint>,
): AhuEquipmentSlot {
  const relatedPoints = picked.related;
  const displayLines = buildProcessSlotDisplayLines(def, relatedPoints);
  const { displayValue, stateLabel } = resolveProcessPrimaryDisplay(
    def,
    picked.primary,
    displayLines,
  );

  return {
    slotId: def.slotId,
    equipmentCode: def.equipmentCode,
    role: def.role,
    lane: def.lane,
    componentType: def.componentType,
    label: def.label,
    x: def.x,
    y: def.y,
    labelPosition: def.labelPosition,
    primaryPoint: picked.primary,
    relatedPoints,
    displayLines,
    displayValue,
    stateLabel,
    chartAffordance: slotHasChartAffordance(def.role),
    confidence: picked.confidence,
    alarm: Boolean(picked.primary?.statusInAlarm),
    fault: Boolean(picked.primary?.statusFault),
  };
}

function materializeStatusSlot(
  def: AhuStatusSlotDef,
  picked: ReturnType<typeof pickBestPoint>,
): AhuStatusSlot {
  return {
    slotId: def.slotId,
    label: def.label,
    order: def.order,
    primaryPoint: picked.primary,
    relatedPoints: picked.related,
    displayValue: picked.primary
      ? formatStatusStripeValue(def.slotId, picked.primary)
      : null,
    confidence: picked.confidence,
    alarm: Boolean(picked.primary?.statusInAlarm),
  };
}

function buildPrimaryCandidates(
  points: readonly InfraspawnPointListItem[],
  processBlueprint: readonly AhuBlueprintSlotDef[],
  statusBlueprint: readonly AhuStatusSlotDef[],
  elementKey?: string | null,
): SlotBindingCandidate[] {
  const candidates: SlotBindingCandidate[] = [];

  for (const def of processBlueprint) {
    const codes = resolveAhuBlueprintEquipmentCodes(def);
    for (const point of points) {
      if (!isAhuBindablePoint(point, elementKey)) continue;
      if (!pointSuitableForProcessSlot(point, def)) continue;
      const match = scorePointForSlot(point, def, codes, elementKey);
      if (match) {
        candidates.push({ slotId: def.slotId, point, ...match });
      }
    }
  }

  for (const def of statusBlueprint) {
    for (const point of points) {
      if (!isAhuBindablePoint(point, elementKey)) continue;
      const templateScore = scoreTemplateBinding(point, def.slotId, elementKey);
      const statusScore = scoreStatusMatch(point, def.signalPatterns);
      const score = Math.max(templateScore, statusScore);
      if (score > 0) {
        candidates.push({
          slotId: def.slotId,
          point,
          score,
          confidence: score >= 95 ? "exact" : "alias",
        });
      }
    }
  }

  return candidates;
}

export function summarizeAhuIdentification(
  processSlots: readonly AhuEquipmentSlot[],
  statusSlots: readonly AhuStatusSlot[],
): AhuIdentificationSummary {
  const all = [...processSlots, ...statusSlots];
  const exact = all.filter((slot) => slot.confidence === "exact").length;
  const alias = all.filter((slot) => slot.confidence === "alias").length;
  const inferred = all.filter((slot) => slot.confidence === "inferred").length;
  const missing = all.filter((slot) => slot.confidence === "missing").length;
  const total = all.length;
  const bound = exact + alias + inferred;
  return {
    exact,
    alias,
    inferred,
    missing,
    total,
    coveragePct: total > 0 ? Math.round((bound / total) * 100) : 0,
  };
}

function applySchemaSlotOverrides(
  slotPrimary: Map<string, SlotBindingCandidate>,
  points: readonly InfraspawnPointListItem[],
  schemaSlotOverrides: ReadonlyMap<string, string> | undefined,
  elementKey?: string | null,
): Map<string, SlotBindingCandidate> {
  if (!schemaSlotOverrides || schemaSlotOverrides.size === 0) {
    return slotPrimary;
  }

  const result = new Map(slotPrimary);

  for (const point of points) {
    const slotId = schemaSlotOverrides.get(pointKey(point));
    if (!slotId) continue;
    if (!isAhuBindablePoint(point, elementKey)) continue;

    for (const [existingSlotId, candidate] of [...result]) {
      if (existingSlotId === slotId) {
        result.delete(existingSlotId);
      }
      if (pointKey(candidate.point) === pointKey(point)) {
        result.delete(existingSlotId);
      }
    }

    result.set(slotId, {
      slotId,
      point,
      score: 200,
      confidence: "exact",
    });
  }

  return result;
}

function resolveProcessSlotPicked(
  def: AhuBlueprintSlotDef,
  forcedPrimary: SlotBindingCandidate | undefined,
  points: readonly InfraspawnPointListItem[],
  pointToSlot: ReadonlyMap<string, string>,
  elementKey?: string | null,
): ReturnType<typeof pickBestPoint> {
  const slotCandidates = collectProcessSlotCandidates(
    def,
    points,
    pointToSlot,
    elementKey,
  );

  if (!forcedPrimary) {
    return pickBestPoint(slotCandidates);
  }

  const forcedKey = pointKey(forcedPrimary.point);
  const merged = slotCandidates.some((entry) => pointKey(entry.point) === forcedKey)
    ? slotCandidates
    : [
        {
          point: forcedPrimary.point,
          score: forcedPrimary.score,
          confidence: forcedPrimary.confidence,
        },
        ...slotCandidates,
      ];

  return pickBestPoint(merged);
}

export function isSourceVisibleEquipmentSlot(slot: AhuEquipmentSlot): boolean {
  return (
    slot.confidence !== "missing" &&
    (slot.primaryPoint != null || slot.relatedPoints.length > 0)
  );
}

export function isSourceVisibleStatusSlot(slot: AhuStatusSlot): boolean {
  return slot.confidence !== "missing" && slot.primaryPoint != null;
}

/** Filtrerer til bundne slotter — brukes i liste/diagnostikk, ikke prosess-skjema. */
export function filterSourceVisibleSlots(
  model: AhuPresentationModel,
): AhuPresentationModel {
  return {
    ...model,
    processSlots: model.processSlots.filter(isSourceVisibleEquipmentSlot),
    statusSlots: model.statusSlots.filter(isSourceVisibleStatusSlot),
  };
}

export function buildAhuPresentationModel(
  points: readonly InfraspawnPointListItem[],
  options: BuildAhuPresentationModelOptions = {},
): AhuPresentationModel {
  const elementKey = options.elementKey ?? null;
  const blueprint = resolveAhuBlueprintOrDefault(options.templateId);

  const slotPrimary = applySchemaSlotOverrides(
    assignPrimarySlotsGlobally(
      buildPrimaryCandidates(
        points,
        blueprint.processSlots,
        [...blueprint.statusSlots],
        elementKey,
      ),
    ),
    points,
    options.schemaSlotOverrides,
    elementKey,
  );

  const pointToSlot = new Map<string, string>();
  for (const [slotId, candidate] of slotPrimary) {
    pointToSlot.set(pointKey(candidate.point), slotId);
  }

  const processSlots = blueprint.processSlots.map((def) => {
    const forcedPrimary = slotPrimary.get(def.slotId);
    const picked = resolveProcessSlotPicked(
      def,
      forcedPrimary,
      points,
      pointToSlot,
      elementKey,
    );
    for (const point of picked.related) {
      pointToSlot.set(pointKey(point), def.slotId);
    }
    return materializeProcessSlot(def, picked);
  });

  const statusSlots = [...blueprint.statusSlots]
    .sort((a, b) => a.order - b.order)
    .map((def) => {
      const primary = slotPrimary.get(def.slotId);
      const picked = primary
        ? pickBestPoint([
            {
              point: primary.point,
              score: primary.score,
              confidence: primary.confidence,
            },
          ])
        : pickBestPoint([]);
      return materializeStatusSlot(def, picked);
    });

  return {
    processSlots,
    statusSlots,
    summary: summarizeAhuIdentification(processSlots, statusSlots),
  };
}

export function resolveProcessSlotLabelForPoint(
  point: InfraspawnPointListItem,
  model: AhuPresentationModel,
): string | null {
  for (const slot of model.processSlots) {
    if (
      slot.relatedPoints.some(
        (entry) =>
          entry.sourceId === point.sourceId &&
          entry.objectId === point.objectId,
      )
    ) {
      return `${slot.equipmentCode} ${slot.role}`;
    }
  }
  for (const slot of model.statusSlots) {
    if (
      slot.relatedPoints.some(
        (entry) =>
          entry.sourceId === point.sourceId &&
          entry.objectId === point.objectId,
      )
    ) {
      return slot.label;
    }
  }
  return null;
}
