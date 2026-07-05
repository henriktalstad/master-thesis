import type { SdAnleggFeaturedPointRef } from "@/lib/sd-anlegg/site-profile-schema";
import {
  isTechnicalAlarmSignalRef,
  resolveAlarmSignalTitle,
} from "@/lib/infraspawn/alarm-signal-label";
import { parseInfraspawnTfmIdentity } from "@/lib/infraspawn/parse-infraspawn-tfm-identity";
import {
  normalizeInfraspawnObjectId,
  resolveInfraspawnPointLocationLabel,
} from "@/lib/infraspawn/point-location-label";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export type AlarmDisplayContext = {
  locationLabel: string | null;
  signalLabel: string;
  equipmentRef: string | null;
  primaryTitle: string;
  secondaryLine: string;
  modalTitle: string;
};

function normalizeAlarmText(alarmText: string, objectId: string): string {
  const trimmed = alarmText.trim();
  const colon = trimmed.indexOf(":");
  if (colon <= 0) return trimmed;

  const prefix = trimmed.slice(0, colon).trim();
  const suffix = trimmed.slice(colon + 1).trim();
  if (
    suffix &&
    !isTechnicalAlarmSignalRef(suffix) &&
    (prefix === objectId || isTechnicalAlarmSignalRef(prefix))
  ) {
    return suffix;
  }

  return trimmed;
}

function resolveEquipmentRef(input: {
  objectId: string;
  objectName?: string | null;
  description?: string | null;
}): string | null {
  const tfm = parseInfraspawnTfmIdentity({
    objectName: input.objectName ?? input.objectId,
    description: input.description,
  });
  return tfm?.equipmentCode ?? null;
}

function findLabeledPointRef(input: {
  sourceId: string;
  objectId: string;
  alarmEquipment: string | null;
  refs: readonly SdAnleggFeaturedPointRef[] | undefined;
}): string | null {
  if (!input.refs?.length) return null;

  const normalizedObjectId = normalizeInfraspawnObjectId(input.objectId);

  for (const ref of input.refs) {
    if (ref.sourceId !== input.sourceId) continue;
    if (normalizeInfraspawnObjectId(ref.objectId) === normalizedObjectId) {
      const label = ref.label.trim();
      if (label) return label;
    }
  }

  if (!input.alarmEquipment) return null;

  for (const ref of input.refs) {
    if (ref.sourceId !== input.sourceId) continue;
    const refEquipment = resolveEquipmentRef({
      objectId: ref.objectId,
      objectName: ref.objectId,
      description: null,
    });
    if (refEquipment === input.alarmEquipment) {
      const label = ref.label.trim();
      if (label) return label;
    }
  }

  return null;
}

function resolveLocationLabel(input: {
  sourceId: string;
  objectId: string;
  sourceLabel?: string | null;
  description?: string | null;
  objectName?: string | null;
  featuredPointRefs?: readonly SdAnleggFeaturedPointRef[];
  pointDisplayOverrides?: readonly SdAnleggFeaturedPointRef[];
  relatedPoints?: readonly InfraspawnPointListItem[];
}): string | null {
  const alarmEquipment = resolveEquipmentRef(input);

  const override = findLabeledPointRef({
    sourceId: input.sourceId,
    objectId: input.objectId,
    alarmEquipment,
    refs: input.pointDisplayOverrides,
  });
  if (override) return override;

  const featured = findLabeledPointRef({
    sourceId: input.sourceId,
    objectId: input.objectId,
    alarmEquipment,
    refs: input.featuredPointRefs,
  });
  if (featured) return featured;

  const inferred = resolveInfraspawnPointLocationLabel({
    point: {
      objectId: input.objectId,
      objectName: input.objectName ?? null,
      description: input.description ?? null,
      sourceLabel: input.sourceLabel ?? "",
    },
    relatedPoints: input.relatedPoints,
  });
  if (inferred) return inferred;

  const objectName = input.objectName?.trim();
  if (objectName && !isTechnicalAlarmSignalRef(objectName)) {
    return objectName;
  }

  const description = input.description?.trim();
  if (description && !isTechnicalAlarmSignalRef(description)) {
    return description;
  }

  return null;
}

function abbreviateSignalForModal(signalLabel: string): string {
  if (/^romtemperatur$/i.test(signalLabel)) return "Romtemp.";
  if (/temperatur$/i.test(signalLabel)) {
    return signalLabel.replace(/temperatur$/i, "temp.");
  }
  return signalLabel;
}

export function resolveAlarmDisplayContext(input: {
  sourceId: string;
  objectId: string;
  alarmText: string;
  sourceLabel?: string | null;
  description?: string | null;
  objectName?: string | null;
  featuredPointRefs?: readonly SdAnleggFeaturedPointRef[];
  pointDisplayOverrides?: readonly SdAnleggFeaturedPointRef[];
  relatedPoints?: readonly InfraspawnPointListItem[];
}): AlarmDisplayContext {
  const normalizedAlarmText = normalizeAlarmText(input.alarmText, input.objectId);
  const signalLabel = resolveAlarmSignalTitle({
    alarmText: normalizedAlarmText,
    objectId: input.objectId,
    objectName: input.objectName,
    description: input.description,
  });

  const equipmentRef = resolveEquipmentRef(input);
  const locationLabel = resolveLocationLabel(input);
  const primaryTitle = locationLabel ?? signalLabel;

  const secondaryParts = [
    equipmentRef,
    locationLabel ? signalLabel : null,
    !locationLabel && !equipmentRef ? input.objectId : null,
  ].filter(Boolean);
  const secondaryLine = secondaryParts.join(" · ") || input.objectId;

  const modalTitle = locationLabel
    ? `${abbreviateSignalForModal(signalLabel)} ${locationLabel.toLowerCase()}`
    : signalLabel;

  return {
    locationLabel,
    signalLabel,
    equipmentRef,
    primaryTitle,
    secondaryLine,
    modalTitle,
  };
}

export function formatInfraspawnChartSeriesLabel(input: {
  signalLabel: string;
  locationLabel?: string | null;
}): string {
  const signal = input.signalLabel.trim();
  const location = input.locationLabel?.trim();
  if (location) return `${signal} - ${location}`;
  return signal;
}

export function enrichAlarmGroupDisplayContext<
  T extends {
    sourceId: string;
    objectId: string;
    alarmText: string;
    objectName?: string | null;
    description?: string | null;
  },
>(
  group: T,
  input?: {
    featuredPointRefs?: readonly SdAnleggFeaturedPointRef[];
    pointDisplayOverrides?: readonly SdAnleggFeaturedPointRef[];
  },
): T & AlarmDisplayContext {
  const display = resolveAlarmDisplayContext({
    sourceId: group.sourceId,
    objectId: group.objectId,
    alarmText: group.alarmText,
    objectName: group.objectName,
    description: group.description,
    featuredPointRefs: input?.featuredPointRefs,
    pointDisplayOverrides: input?.pointDisplayOverrides,
  });

  return { ...group, ...display };
}
