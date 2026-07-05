import {
  parseInfraspawnTfmIdentity,
  type InfraspawnTfmIdentity,
} from "@/lib/infraspawn/parse-infraspawn-tfm-identity";

export type InfraspawnPointIdentityInput = {
  objectName?: string | null;
  description?: string | null;
  sourceLabel?: string;
};

export function parseInfraspawnPointIdentity(
  point: InfraspawnPointIdentityInput,
): InfraspawnTfmIdentity | null {
  return parseInfraspawnTfmIdentity({
    objectName: point.objectName,
    description: point.description,
    sourceLabel: point.sourceLabel ?? "",
  });
}
