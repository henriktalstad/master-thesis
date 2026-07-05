export type ControlSignalBindingSource =
  | "manual"
  | "override"
  | "alias"
  | "pattern"
  | "bootstrap";

export type ControlSignalBindingConfidence = "high" | "medium" | "low";

export type ControlSignalBinding = {
  sourceId: string;
  objectId: string;
  canonicalId: string;
  unitKey?: string;
  slotId?: string;
  source: ControlSignalBindingSource;
  confidence: ControlSignalBindingConfidence;
};

function isControlSignalBinding(value: unknown): value is ControlSignalBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.sourceId === "string" &&
    typeof record.objectId === "string" &&
    typeof record.canonicalId === "string" &&
    record.sourceId.trim().length > 0 &&
    record.objectId.trim().length > 0 &&
    record.canonicalId.trim().length > 0
  );
}

function trimOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function controlSignalBindingKey(input: {
  sourceId: string;
  canonicalId: string;
  unitKey?: string;
}): string {
  const unit = input.unitKey?.replace(/\./g, "") ?? "*";
  return `${input.sourceId}:${unit}:${input.canonicalId}`;
}

const CONFIDENCE_RANK: Record<ControlSignalBindingConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const SOURCE_RANK: Record<ControlSignalBindingSource, number> = {
  manual: 5,
  override: 4,
  alias: 3,
  pattern: 2,
  bootstrap: 1,
};

export function parseControlSignalBindings(raw: unknown): ControlSignalBinding[] {
  if (!Array.isArray(raw)) return [];

  const byKey = new Map<string, ControlSignalBinding>();
  for (const entry of raw) {
    if (!isControlSignalBinding(entry)) continue;
    const binding: ControlSignalBinding = {
      sourceId: entry.sourceId.trim(),
      objectId: entry.objectId.trim(),
      canonicalId: entry.canonicalId.trim(),
      source:
        entry.source === "manual" ||
        entry.source === "override" ||
        entry.source === "alias" ||
        entry.source === "pattern" ||
        entry.source === "bootstrap"
          ? entry.source
          : "bootstrap",
      confidence:
        entry.confidence === "high" ||
        entry.confidence === "medium" ||
        entry.confidence === "low"
          ? entry.confidence
          : "medium",
    };
    const unitKey = trimOptional(entry.unitKey);
    const slotId = trimOptional(entry.slotId);
    if (unitKey) binding.unitKey = unitKey;
    if (slotId) binding.slotId = slotId;

    const key = controlSignalBindingKey({
      sourceId: binding.sourceId,
      canonicalId: binding.canonicalId,
      unitKey: binding.unitKey,
    });
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, binding);
      continue;
    }
    const existingScore =
      CONFIDENCE_RANK[existing.confidence] + SOURCE_RANK[existing.source];
    const nextScore =
      CONFIDENCE_RANK[binding.confidence] + SOURCE_RANK[binding.source];
    if (nextScore >= existingScore) {
      byKey.set(key, binding);
    }
  }

  return [...byKey.values()];
}

export function mergeControlSignalBindings(
  ...groups: readonly (readonly ControlSignalBinding[])[]
): ControlSignalBinding[] {
  const byKey = new Map<string, ControlSignalBinding>();

  for (const group of groups) {
    for (const binding of group) {
      const key = controlSignalBindingKey(binding);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, binding);
        continue;
      }
      const existingScore =
        CONFIDENCE_RANK[existing.confidence] + SOURCE_RANK[existing.source];
      const nextScore =
        CONFIDENCE_RANK[binding.confidence] + SOURCE_RANK[binding.source];
      if (nextScore >= existingScore) {
        byKey.set(key, binding);
      }
    }
  }

  return [...byKey.values()];
}

export function findControlSignalBinding(input: {
  bindings: readonly ControlSignalBinding[];
  sourceId: string;
  canonicalId: string;
  unitKey?: string;
}): ControlSignalBinding | null {
  const normalizedUnit = input.unitKey?.replace(/\./g, "");

  const scoped = input.bindings.filter((binding) => {
    if (binding.sourceId !== input.sourceId) return false;
    if (binding.canonicalId !== input.canonicalId) return false;
    if (!normalizedUnit) return true;
    if (!binding.unitKey) return true;
    return binding.unitKey.replace(/\./g, "") === normalizedUnit;
  });

  if (scoped.length === 0) return null;

  const unitExact = normalizedUnit
    ? scoped.find(
        (binding) =>
          binding.unitKey?.replace(/\./g, "") === normalizedUnit,
      )
    : null;
  if (unitExact) return unitExact;

  const global = scoped.find((binding) => !binding.unitKey);
  if (global) return global;

  return scoped[0] ?? null;
}

export function upsertControlSignalBinding(
  existing: readonly ControlSignalBinding[],
  patch: ControlSignalBinding,
): ControlSignalBinding[] {
  const key = controlSignalBindingKey(patch);
  const next = existing.filter(
    (entry) => controlSignalBindingKey(entry) !== key,
  );
  next.push(patch);
  return next;
}
