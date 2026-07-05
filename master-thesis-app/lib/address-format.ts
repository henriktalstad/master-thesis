import { normalizeAddress } from "@/lib/address-format/normalize-address";

export function formatAddressForDisplay(
  input: string | null | undefined,
): string {
  if (!input) return "";

  let address = input.replace(/,/g, " ").replace(/\s+/g, " ").trim();

  address = address.replace(/([A-Za-zæøåÆØÅ])([0-9]+)/g, "$1 $2");

  address = address.replace(
    /(\d+)\s*([a-zA-Z])\b/g,
    (m, num, letter) => `${num}${letter.toUpperCase()}`,
  );

  const lowerKeep = new Set([
    "gate",
    "vei",
    "veg",
    "plass",
    "alle",
    "sør",
    "nord",
    "øst",
    "vest",
  ]);

  const parts = address.split(" ");
  const cased = parts.map((part) => {
    if (/^\d+[A-Z]?$/.test(part)) return part;

    const plain = part.toLowerCase();
    if (lowerKeep.has(plain)) return plain;

    return plain.charAt(0).toUpperCase() + plain.slice(1);
  });

  return cased.join(" ");
}

export function parseLooseAddressField(value: unknown): {
  line: string;
  postCode: string;
  postalPlace: string;
} {
  const empty = { line: "", postCode: "", postalPlace: "" };
  if (value == null) return empty;
  if (typeof value === "string") return { ...empty, line: value.trim() };
  if (typeof value === "number" || typeof value === "boolean") {
    return { ...empty, line: String(value) };
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    const line =
      typeof o.addrLine === "string"
        ? o.addrLine.trim()
        : typeof o.address === "string"
          ? o.address.trim()
          : "";
    const postCode =
      typeof o.postCode === "string"
        ? o.postCode.trim()
        : typeof o.postalCode === "string"
          ? o.postalCode.trim()
          : "";
    const postalPlace =
      typeof o.postalPlace === "string" ? o.postalPlace.trim() : "";
    return { line, postCode, postalPlace };
  }
  return { ...empty, line: String(value) };
}

export function coerceAddressLikeToDisplayString(value: unknown): string {
  const p = parseLooseAddressField(value);
  const city = [p.postCode, p.postalPlace].filter(Boolean).join(" ").trim();
  if (p.line && city) return `${p.line}, ${city}`;
  return p.line || city;
}

type HouseNumberRange = {
  numFrom?: number;
  numTo?: number;
  letterFrom?: string;
  letterTo?: string;
};

function extractStreetBaseFromAddress(full: string): string {
  return formatAddressForDisplay(
    (full || "").replace(/\s*\d.*$/, "").trim() || full || "",
  );
}
function parseHouseNumberRangeFromAddressText(
  text: string,
): HouseNumberRange | null {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  const numRange = trimmed.match(
    /(\d+)\s*([A-Za-zÅÄÖÆØåäöæø])?\s*[-–]\s*(\d+)\s*([A-Za-zÅÄÖÆØåäöæø])?/,
  );
  if (numRange) {
    const from = Number.parseInt(numRange[1], 10);
    const to = Number.parseInt(numRange[3], 10);
    if (!Number.isNaN(from) && !Number.isNaN(to)) {
      return {
        numFrom: Math.min(from, to),
        numTo: Math.max(from, to),
        letterFrom: numRange[2]?.toUpperCase() || undefined,
        letterTo: numRange[4]?.toUpperCase() || numRange[2]?.toUpperCase(),
      };
    }
  }

  const single = trimmed.match(/(\d+)([A-Za-zÅÄÖÆØåäöæø]?)/);
  if (single) {
    const n = Number.parseInt(single[1], 10);
    if (!Number.isNaN(n)) {
      const letter = single[2]?.toUpperCase() || undefined;
      return {
        numFrom: n,
        numTo: n,
        letterFrom: letter,
        letterTo: letter,
      };
    }
  }

  const letterRange = trimmed.match(
    /\b([A-Za-zÅÄÖÆØåäöæø])\s*[-–]\s*([A-Za-zÅÄÖÆØåäöæø])\b/,
  );
  if (letterRange) {
    return {
      letterFrom: letterRange[1]?.toUpperCase(),
      letterTo: letterRange[2]?.toUpperCase(),
    };
  }

  return null;
}

function formatHouseNumberRangePart(info: HouseNumberRange): string {
  const withNums = typeof info.numFrom === "number";
  if (withNums) {
    const minPart = `${info.numFrom}${info.letterFrom ?? ""}`;
    const maxPart = `${info.numTo}${info.letterTo ?? ""}`;
    const same =
      info.numFrom === info.numTo &&
      (info.letterFrom || "") === (info.letterTo || "");
    return same ? minPart : `${minPart}-${maxPart}`;
  }

  const lf = info.letterFrom || "";
  const lt = info.letterTo || lf;
  return lf === lt ? lf : `${lf}-${lt}`;
}

function addressGroupKey(a: {
  address: string;
  postCode: string;
  postalPlace: string;
}): string {
  const streetBase = extractStreetBaseFromAddress(a.address);
  return `${streetBase.toLowerCase()}__${(a.postCode || "").trim()}__${(a.postalPlace || "").trim().toLowerCase()}`;
}

type ConsolidatedAddressCandidate = {
  id?: string;
  address: string;
  postCode: string;
  postalPlace: string;
  normalizedAddr?: string;
  numberFrom?: number | null;
  numberTo?: number | null;
  letterFrom?: string | null;
  letterTo?: string | null;
  isPrimary?: boolean;
};

function mergePrimaryAddressIntoCandidates(
  input: {
    address?: string | unknown;
    postCode?: string | null;
    postalPlace?: string | null;
  },
  candidates: ConsolidatedAddressCandidate[],
): ConsolidatedAddressCandidate[] {
  const parsed = parseLooseAddressField(input.address);
  const line = formatAddressForDisplay(parsed.line);
  if (!line) return candidates;

  const postCode = (input.postCode ?? parsed.postCode ?? "").trim();
  const postalPlace = (input.postalPlace ?? parsed.postalPlace ?? "").trim();
  const normalizedKey = `${normalizeAddress(line)}|${postCode}`;

  const alreadyPresent = candidates.some((a) => {
    const key = `${normalizeAddress(a.address)}|${(a.postCode || "").trim()}`;
    return key === normalizedKey;
  });

  if (alreadyPresent) return candidates;

  return [
    {
      address: line,
      postCode,
      postalPlace,
      normalizedAddr: normalizeAddress(line),
      isPrimary: true,
    },
    ...candidates,
  ];
}
export function formatConsolidatedAddressFromBuilding(input: {
  address?: string | unknown;
  postCode?: string;
  postalPlace?: string;
  addresses?: Array<{
    id?: string;
    address: string;
    postCode: string;
    postalPlace: string;
    normalizedAddr?: string;
    numberFrom?: number | null;
    numberTo?: number | null;
    letterFrom?: string | null;
    letterTo?: string | null;
    isPrimary?: boolean;
  }> | null;
}): { addrLine: string; postCode: string; postalPlace: string } {
  const parsed = parseLooseAddressField(input.address);
  const fallback = {
    addrLine: formatAddressForDisplay(parsed.line || "Ikke angitt"),
    postCode: input.postCode || parsed.postCode || "",
    postalPlace: input.postalPlace || parsed.postalPlace || "",
  };

  const rawList = Array.isArray(input.addresses) ? input.addresses : [];
  const list = mergePrimaryAddressIntoCandidates(input, rawList);
  if (list.length === 0) return fallback;

  const groups = new Map<string, typeof list>();
  for (const a of list) {
    const key = addressGroupKey(a);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  const firstEntry = groups.entries().next().value as
    | [string, typeof list]
    | undefined;
  const firstGroup = firstEntry?.[1];
  if (!firstGroup || firstGroup.length === 0) return fallback;

  const primaryAddress = list.find(
    (a) => (a as { isPrimary?: boolean }).isPrimary,
  );
  let chosenGroup: typeof list = firstGroup;
  if (primaryAddress) {
    const primaryKey = addressGroupKey(primaryAddress);
    const primaryGroup = groups.get(primaryKey);
    if (primaryGroup && primaryGroup.length > 0) {
      chosenGroup = primaryGroup;
    }
  }

  const sample = chosenGroup[0];
  const streetBase = extractStreetBaseFromAddress(sample.address);

  const parseNumInfo = (a: (typeof list)[number]): HouseNumberRange | null => {
    if (
      a.numberFrom != null ||
      a.numberTo != null ||
      a.letterFrom ||
      a.letterTo
    ) {
      const from = a.numberFrom ?? undefined;
      const to = a.numberTo ?? from;
      return {
        numFrom: from,
        numTo: to,
        letterFrom: a.letterFrom || undefined,
        letterTo: a.letterTo || undefined,
      };
    }
    return parseHouseNumberRangeFromAddressText(a.address || "");
  };

  const nums: HouseNumberRange[] = [];
  for (const a of chosenGroup) {
    const info = parseNumInfo(a);
    if (info) nums.push(info);
  }

  let addrLine = streetBase || sample.address || fallback.addrLine;
  if (nums.length > 0) {
    const withNums = nums.filter((n) => typeof n.numFrom === "number");
    if (withNums.length > 0) {
      const minFrom = Math.min(...withNums.map((n) => n.numFrom as number));
      const maxTo = Math.max(
        ...withNums.map((n) => (n.numTo ?? n.numFrom) as number),
      );
      const minCandidates = withNums.filter(
        (n) => (n.numFrom ?? 0) === minFrom,
      );
      const maxCandidates = withNums.filter(
        (n) => (n.numTo ?? n.numFrom ?? 0) === maxTo,
      );
      const minLetter = minCandidates
        .map((n) => (n.letterFrom || "").toUpperCase())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))[0];
      const maxLetter = maxCandidates
        .map((n) => (n.letterTo || n.letterFrom || "").toUpperCase())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .slice(-1)[0];
      const rangePart = formatHouseNumberRangePart({
        numFrom: minFrom,
        numTo: maxTo,
        letterFrom: minLetter,
        letterTo: maxLetter,
      });
      addrLine = `${streetBase} ${rangePart}`.trim();
    } else {
      const letters = nums
        .flatMap((n) => [n.letterFrom, n.letterTo])
        .filter((ch): ch is string => Boolean(ch))
        .map((ch) => ch.toUpperCase());
      if (letters.length > 0) {
        const sorted = [...letters].sort((a, b) => a.localeCompare(b));
        const rangePart = formatHouseNumberRangePart({
          letterFrom: sorted[0],
          letterTo: sorted[sorted.length - 1],
        });
        addrLine = `${streetBase} ${rangePart}`.trim();
      }
    }
  }

  const extraGroups = groups.size - 1;
  if (extraGroups > 0) addrLine = `${addrLine} +${extraGroups}`;

  return {
    addrLine,
    postCode: input.postCode || sample.postCode || "",
    postalPlace: input.postalPlace || sample.postalPlace || "",
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function addressLineAfterRedundantNamePrefix(
  name: string,
  addressLine: string,
): string | false {
  const n = name.trim();
  const a = addressLine.trim();
  if (!n || !a) return false;
  try {
    const re = new RegExp(`^${escapeRegExp(n)}\\s*,\\s*(.*)$`, "i");
    const m = a.match(re);
    if (!m) return false;
    return m[1].trim();
  } catch {
    return false;
  }
}
export function splitBuildingNameAndAddressForDisplay(
  name: string | null | undefined,
  address: string | null | undefined,
): { primary: string; secondary: string | null } {
  const n = (name ?? "").trim();
  const a = (address ?? "").trim();
  if (!n && !a) return { primary: "", secondary: null };
  if (!n) return { primary: a, secondary: null };
  if (!a) return { primary: n, secondary: null };
  if (n.localeCompare(a, undefined, { sensitivity: "accent" }) === 0) {
    return { primary: n, secondary: null };
  }
  const tail = addressLineAfterRedundantNamePrefix(n, a);
  if (tail !== false) {
    return { primary: n, secondary: tail.length > 0 ? tail : null };
  }
  return { primary: n, secondary: a };
}

type DisplayAddressCandidate = {
  id?: string;
  address?: string | null;
  postCode?: string | null;
  postalPlace?: string | null;
  normalizedAddr?: string | null;
  numberFrom?: number | null;
  numberTo?: number | null;
  letterFrom?: string | null;
  letterTo?: string | null;
  isPrimary?: boolean;
};
export function dedupeAddressCandidatesForDisplay(
  addresses: DisplayAddressCandidate[] | null | undefined,
): Array<{
  address: string;
  postCode: string;
  postalPlace: string;
  normalizedAddr?: string;
  numberFrom?: number;
  numberTo?: number;
  letterFrom?: string;
  letterTo?: string;
  isPrimary?: boolean;
}> {
  if (!Array.isArray(addresses) || addresses.length === 0) return [];

  const seen = new Set<string>();
  const deduped: Array<{
    address: string;
    postCode: string;
    postalPlace: string;
    normalizedAddr?: string;
    numberFrom?: number;
    numberTo?: number;
    letterFrom?: string;
    letterTo?: string;
    isPrimary?: boolean;
  }> = [];

  for (const addr of addresses) {
    const displayAddress = formatAddressForDisplay(addr.address || "");
    const postCode = (addr.postCode || "").trim();
    const postalPlace = (addr.postalPlace || "").trim();
    const normalizedKey =
      (addr.normalizedAddr || "").trim() ||
      normalizeAddress(addr.address || displayAddress);
    const dedupeKey = `${normalizedKey}|${postCode}|${postalPlace.toLowerCase()}`;
    if (!displayAddress) continue;

    const entry = {
      address: displayAddress,
      postCode,
      postalPlace,
      normalizedAddr: addr.normalizedAddr ?? undefined,
      numberFrom: addr.numberFrom ?? undefined,
      numberTo: addr.numberTo ?? undefined,
      letterFrom: addr.letterFrom ?? undefined,
      letterTo: addr.letterTo ?? undefined,
      isPrimary: addr.isPrimary,
    };

    if (seen.has(dedupeKey)) {
      const idx = deduped.findIndex(
        (d) =>
          `${d.normalizedAddr || normalizeAddress(d.address)}|${d.postCode}|${d.postalPlace.toLowerCase()}` ===
          dedupeKey,
      );
      if (idx >= 0) {
        const prev = deduped[idx];
        deduped[idx] = {
          ...prev,
          numberFrom:
            prev.numberFrom != null && entry.numberFrom != null
              ? Math.min(prev.numberFrom, entry.numberFrom)
              : (prev.numberFrom ?? entry.numberFrom),
          numberTo:
            prev.numberTo != null && entry.numberTo != null
              ? Math.max(prev.numberTo, entry.numberTo)
              : (prev.numberTo ?? entry.numberTo),
          isPrimary: prev.isPrimary || entry.isPrimary,
        };
      }
      continue;
    }

    seen.add(dedupeKey);
    deduped.push(entry);
  }

  return deduped;
}

export type BuildingAddressDisplayInput = {
  address?: string | unknown;
  postCode?: string | null;
  postalPlace?: string | null;
  addresses?: DisplayAddressCandidate[] | null;
};
export type BuildingAddressRecord = {
  address?: string | null;
  postCode?: string | null;
  postalPlace?: string | null;
  addresses?: DisplayAddressCandidate[] | null;
};

export function toBuildingAddressDisplayInput(
  building: BuildingAddressRecord,
): BuildingAddressDisplayInput {
  return {
    address: building.address,
    postCode: building.postCode,
    postalPlace: building.postalPlace,
    addresses: building.addresses ?? undefined,
  };
}

export type BuildingAddressDisplayResult = {
  primaryLine: string;
  cityLine: string;
  summaryLine: string;
  allLines: string[];
  extraAddressCount: number;
};
export function formatBuildingAddressesForDisplay(
  input: BuildingAddressDisplayInput,
): BuildingAddressDisplayResult {
  const rawCandidates: ConsolidatedAddressCandidate[] = (
    input.addresses ?? []
  ).map((a) => ({
    id: a.id,
    address: formatAddressForDisplay(a.address || ""),
    postCode: (a.postCode || "").trim(),
    postalPlace: (a.postalPlace || "").trim(),
    normalizedAddr: a.normalizedAddr ?? undefined,
    numberFrom: a.numberFrom ?? undefined,
    numberTo: a.numberTo ?? undefined,
    letterFrom: a.letterFrom ?? undefined,
    letterTo: a.letterTo ?? undefined,
    isPrimary: (a as { isPrimary?: boolean }).isPrimary,
  }));

  const merged = mergePrimaryAddressIntoCandidates(input, rawCandidates);
  const deduped = dedupeAddressCandidatesForDisplay(merged);

  const consolidated = formatConsolidatedAddressFromBuilding({
    address: input.address,
    postCode: input.postCode ?? deduped[0]?.postCode,
    postalPlace: input.postalPlace ?? deduped[0]?.postalPlace,
    addresses: deduped,
  });

  const cityLine = [consolidated.postCode, consolidated.postalPlace]
    .filter(Boolean)
    .join(" ")
    .trim();

  const legacyPlus = consolidated.addrLine.match(/\s\+(\d+)$/);
  const extraFromLegacyPlus = legacyPlus
    ? Number.parseInt(legacyPlus[1], 10)
    : 0;
  const primaryLine = legacyPlus
    ? consolidated.addrLine.replace(/\s\+\d+$/, "").trim()
    : consolidated.addrLine;

  const distinctGroups = new Set(deduped.map((a) => addressGroupKey(a)));
  const extraAddressCount = Math.max(
    extraFromLegacyPlus,
    Math.max(0, distinctGroups.size - 1),
  );

  const allLines = deduped.map((a) => {
    const city = [a.postCode, a.postalPlace].filter(Boolean).join(" ").trim();
    return city ? `${a.address}, ${city}` : a.address;
  });

  const summaryLine = cityLine ? `${primaryLine}, ${cityLine}` : primaryLine;

  return {
    primaryLine: primaryLine || "Ikke angitt",
    cityLine,
    summaryLine,
    allLines: allLines.length > 0 ? allLines : summaryLine ? [summaryLine] : [],
    extraAddressCount,
  };
}
export function buildingAddressSortKey(
  building: BuildingAddressRecord,
): string {
  return formatBuildingAddressesForDisplay(
    toBuildingAddressDisplayInput(building),
  ).summaryLine;
}
