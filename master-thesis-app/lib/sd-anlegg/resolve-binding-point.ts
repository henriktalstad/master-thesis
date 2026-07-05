import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdLayoutBinding } from "./layout-schema";

function normalizeRef(value: string): string {
  return value.trim().toUpperCase();
}

export function resolveSdAnleggBindingPoint(
  binding: SdLayoutBinding,
  points: readonly InfraspawnPointListItem[],
): InfraspawnPointListItem | undefined {
  const ref = binding.objectId.trim();
  if (!ref) return undefined;

  if (binding.sourceId) {
    const scoped = points.find(
      (point) =>
        point.sourceId === binding.sourceId && point.objectId === ref,
    );
    if (scoped) return scoped;
  }

  const byObjectId = points.find((point) => point.objectId === ref);
  if (byObjectId) return byObjectId;

  const refNorm = normalizeRef(ref);
  const byExactName = points.find(
    (point) => normalizeRef(point.objectName ?? "") === refNorm,
  );
  if (byExactName) return byExactName;

  return points.find((point) => {
    const name = point.objectName?.trim();
    if (!name) return false;
    const nameNorm = normalizeRef(name);
    return (
      nameNorm.endsWith(refNorm) ||
      nameNorm.includes(refNorm) ||
      nameNorm.includes(`.${refNorm}`)
    );
  });
}
