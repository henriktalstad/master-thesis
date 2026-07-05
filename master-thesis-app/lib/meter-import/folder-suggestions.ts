import type { MeteringPointType } from "@/generated/client";

export type MeterFolderSuggestion = {
  tempId: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  isPrimary: boolean;
  meterTempIds: string[];
  source: "import";
};

type RowWithFolderContext = {
  tempId: string;
  type?: MeteringPointType | string | null;
  block?: string | null;
  groupBlock?: string | null;
};

const TYPE_TO_FOLDER_ICON: Partial<Record<MeteringPointType, string>> = {
  ELECTRICITY: "bolt",
  HEAT: "flame",
  COOLING: "snowflake",
  PRODUCTION: "sun",
};

function normalizeFolderName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function folderKey(value: string): string {
  return normalizeFolderName(value).toLowerCase();
}

function slugForTempId(value: string): string {
  const slug = normalizeFolderName(value)
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "mappe";
}

function pickIcon(types: Array<MeteringPointType | string | null | undefined>) {
  const counts = new Map<MeteringPointType, number>();
  for (const type of types) {
    if (
      type === "ELECTRICITY" ||
      type === "HEAT" ||
      type === "COOLING" ||
      type === "PRODUCTION" ||
      type === "WATER"
    ) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }
  if (counts.size !== 1) return "folder";
  const [type] = counts.keys();
  return TYPE_TO_FOLDER_ICON[type] ?? "folder";
}

export function generateMeterFolderSuggestions(
  rows: RowWithFolderContext[],
): MeterFolderSuggestion[] {
  const grouped = new Map<
    string,
    {
      name: string;
      meterTempIds: string[];
      types: Array<MeteringPointType | string | null | undefined>;
    }
  >();

  for (const row of rows) {
    const rawName = row.block || row.groupBlock;
    if (!rawName) continue;

    const name = normalizeFolderName(rawName);
    if (!name) continue;

    const key = folderKey(name);
    const existing = grouped.get(key);
    if (existing) {
      existing.meterTempIds.push(row.tempId);
      existing.types.push(row.type);
    } else {
      grouped.set(key, {
        name,
        meterTempIds: [row.tempId],
        types: [row.type],
      });
    }
  }

  return Array.from(grouped.values()).map((folder, index) => ({
    tempId: `mfi_${index}_${slugForTempId(folder.name)}`,
    name: folder.name,
    icon: pickIcon(folder.types),
    sortOrder: index,
    isPrimary: true,
    meterTempIds: Array.from(new Set(folder.meterTempIds)),
    source: "import" as const,
  }));
}
