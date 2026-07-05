export type CreateInfraspawnSourceResult =
  | { outcome: "created"; sourceId: string }
  | { outcome: "already_exists"; message: string }
  | { outcome: "error"; error: string };

export function infraspawnDuplicateSourceMessage(
  label: string,
  buildingName: string | null,
): string {
  const suffix = buildingName ? ` (${buildingName})` : "";
  return `Dette anlegget er allerede koblet til som «${label}»${suffix}.`;
}

export function alreadyExistsInfraspawnSourceResult(source: {
  label: string;
  buildingName: string | null;
}): Extract<CreateInfraspawnSourceResult, { outcome: "already_exists" }> {
  return {
    outcome: "already_exists",
    message: infraspawnDuplicateSourceMessage(source.label, source.buildingName),
  };
}

export const INFRASPAWN_SOURCE_ALREADY_EXISTS_MESSAGE =
  "Dette anlegget er allerede koblet til Infraspawn.";
