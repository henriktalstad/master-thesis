import type {
  BuildingMeteringTopology,
  MeteringPointType,
} from "@/generated/client";
import { detectTopologyFromMeters } from "@/lib/energy-flow/classification-rules";
import type { TransformedRow } from "./row-transformer";
import { isSameElement, type KsTag } from "./ks-tag-parser";
import { isValidElhubMpid } from "@/lib/meter-archetypes";


export type RowWithTempId = TransformedRow & { tempId: string };

export type ExistingMeterCandidate = {
  id: string;
  mpid: string;
  name: string | null;
  type: MeteringPointType;
  isSubMeter: boolean;
};

export const EXISTING_PARENT_PREFIX = "existing:";
export function isExistingParentTempId(tempId: string): boolean {
  return tempId.startsWith(EXISTING_PARENT_PREFIX);
}
export function unwrapExistingParentTempId(tempId: string): string | null {
  if (!isExistingParentTempId(tempId)) return null;
  return tempId.slice(EXISTING_PARENT_PREFIX.length);
}

export type ResolvedTopologyForRow = {
  tempId: string;
  parentTempId: string | null;
  energySourcedFromTempId: string | null;
  hasChildren: boolean;
  parentReason: string | null;
  energySourceReason: string | null;
};

export type ResolvedTopology = {
  buildingTopology: BuildingMeteringTopology;
  topologyConfidence: "low" | "medium" | "high";
  topologyReason: string;
  perRow: Map<string, ResolvedTopologyForRow>;
};


const HEAT_SOURCE_NAME_RX =
  /var?me\s*pumpe|heatpump|\bvp\b|\bwp\b|el[\s-]?kjel|elektrokjel|electric\s*boiler|var?me\s+produsert|var?me\s+produksjon|produsert\s+var?me/i;

const COOL_SOURCE_NAME_RX =
  /chiller|kj[øo]le\s*maskin|var?me\s*pumpe.*kj[øo]l|kj[øo]le\s*maskin.*var?me\s*pumpe/i;

const BRONN_NAME_RX =
  /br\u00f8nn\s*park|bronn\s*park|geo\s*sonde|borehull|brine/i;


export interface ResolveTopologyOptions {
  existingMeters?: ExistingMeterCandidate[];
}

export function resolveTopology(
  rows: RowWithTempId[],
  options: ResolveTopologyOptions = {},
): ResolvedTopology {
  const existingMeters = options.existingMeters ?? [];
  const topologyInputRows = [
    ...rows.map((r) => ({
      type: r.type,
      isSubMeter: r.isSubMeter,
      hasAmsLink: !r.isSubMeter && r.mpid ? isValidElhubMpid(r.mpid) : false,
    })),
    ...existingMeters.map((m) => ({
      type: m.type,
      isSubMeter: m.isSubMeter,
      hasAmsLink: !m.isSubMeter && isValidElhubMpid(m.mpid),
    })),
  ];
  const buildingTopologyDetection = detectTopologyFromMeters(topologyInputRows);

  const existingAsRows: RowWithTempId[] = existingMeters.map((m) => ({
    rowIndex: -1,
    name: m.name,
    mpid: m.mpid,
    type: m.type,
    typeConfidence: 1,
    meterLocation: null,
    subMeterCategory: null,
    subMeterSubCategory: null,
    categoryConfidence: 0,
    isSubMeter: m.isSubMeter,
    parentName: null,
    subMeterLabel: null,
    floor: null,
    block: null,
    bus: null,
    externalId: null,
    tag: null,
    parsedTag: null,
    groupBlock: null,
    customerIntentRaw: {},
    customerIntent: null,
    status: "valid",
    issues: [],
    rawCells: {},
    tempId: `${EXISTING_PARENT_PREFIX}${m.id}`,
  }));

  const allRows = [...rows, ...existingAsRows];

  const perRow = new Map<string, ResolvedTopologyForRow>();
  for (const row of rows) {
    perRow.set(row.tempId, {
      tempId: row.tempId,
      parentTempId: null,
      energySourcedFromTempId: null,
      hasChildren: false,
      parentReason: null,
      energySourceReason: null,
    });
  }
  for (const row of existingAsRows) {
    perRow.set(row.tempId, {
      tempId: row.tempId,
      parentTempId: null,
      energySourcedFromTempId: null,
      hasChildren: false,
      parentReason: null,
      energySourceReason: null,
    });
  }

  resolveTagBasedParents(allRows, perRow);

  resolveParentNameMapping(allRows, perRow);

  resolveExplicitEnergySourceMapping(allRows, perRow);

  resolveNameHeuristicParents(allRows, perRow);

  resolveThermalDistributionParents(allRows, perRow);

  resolveEnergySourceForThermalDistribution(allRows, perRow);

  for (const r of perRow.values()) {
    if (r.parentTempId) {
      const parent = perRow.get(r.parentTempId);
      if (parent) parent.hasChildren = true;
    }
  }

  for (const row of existingAsRows) {
    perRow.delete(row.tempId);
  }

  return {
    buildingTopology: buildingTopologyDetection.topology,
    topologyConfidence: buildingTopologyDetection.confidence,
    topologyReason: buildingTopologyDetection.reason,
    perRow,
  };
}


function resolveTagBasedParents(
  rows: RowWithTempId[],
  perRow: Map<string, ResolvedTopologyForRow>,
): void {
  const groups = new Map<string, RowWithTempId[]>();
  for (const row of rows) {
    if (!row.parsedTag || row.parsedTag.matchKind === "element-only") continue;
    const key = row.parsedTag.element;
    const arr = groups.get(key) ?? [];
    arr.push(row);
    groups.set(key, arr);
  }

  for (const [elementKey, members] of groups) {
    if (members.length < 2) continue;

    const main = pickMainTaggedMeter(members);
    if (!main) continue;

    const allThermal = members.every(
      (m) => m.type === "HEAT" || m.type === "COOLING",
    );
    const hasExplicitMain = main.parsedTag?.isMain === true;
    if (allThermal && !hasExplicitMain) continue;

    for (const candidate of members) {
      if (candidate.tempId === main.tempId) continue;
      const resolved = perRow.get(candidate.tempId);
      if (!resolved || resolved.parentTempId) continue;

      if (candidate.type !== main.type) continue;

      if (candidate.type === "PRODUCTION" || main.type === "PRODUCTION")
        continue;

      resolved.parentTempId = main.tempId;
      resolved.parentReason = `Samme KS-element ${elementKey} — ${main.parsedTag?.meterIndex ?? "main"} er hovedmåler.`;
    }
  }
}

function pickMainTaggedMeter(members: RowWithTempId[]): RowWithTempId | null {
  const oe001 = members.find((m) => m.parsedTag?.isMain);
  if (oe001) return oe001;

  const explicitMain = members.find((m) => !m.isSubMeter);
  if (explicitMain) return explicitMain;

  const sortable = members
    .map((m) => {
      const num = m.parsedTag?.meterIndex
        ? parseInt(m.parsedTag.meterIndex.replace(/\D/g, ""), 10)
        : Number.POSITIVE_INFINITY;
      return { row: m, num };
    })
    .sort((a, b) => a.num - b.num);

  return sortable[0]?.row ?? null;
}


function resolveParentNameMapping(
  rows: RowWithTempId[],
  perRow: Map<string, ResolvedTopologyForRow>,
): void {
  for (const row of rows) {
    const resolved = perRow.get(row.tempId);
    if (!resolved || resolved.parentTempId) continue;
    const parentRef = row.customerIntent?.explicitParentRef?.raw ?? row.parentName;
    if (!parentRef) continue;

    const parent = findBestMeterRef(parentRef, rows, row.tempId);
    if (parent?.confidence && parent.confidence >= 0.75) {
      resolved.parentTempId = parent.row.tempId;
      resolved.parentReason = `Eksplisitt "Overordnet måler" → ${parentRef} (${parent.reason}).`;
    }
  }
}

function resolveExplicitEnergySourceMapping(
  rows: RowWithTempId[],
  perRow: Map<string, ResolvedTopologyForRow>,
): void {
  for (const row of rows) {
    const resolved = perRow.get(row.tempId);
    if (!resolved || resolved.energySourcedFromTempId) continue;
    const sourceRef = row.customerIntent?.explicitEnergySourceRef?.raw;
    if (!sourceRef) continue;

    const source = findBestMeterRef(sourceRef, rows, row.tempId);
    if (source?.confidence && source.confidence >= 0.75) {
      resolved.energySourcedFromTempId = source.row.tempId;
      resolved.energySourceReason = `Eksplisitt "Energikilde" → ${sourceRef} (${source.reason}).`;
    }
  }
}


function resolveNameHeuristicParents(
  rows: RowWithTempId[],
  perRow: Map<string, ResolvedTopologyForRow>,
): void {
  const HOVED_RX = /hoved\s*(?:tavle|fordel|innkommer)/i;
  const UNDER_RX = /\bunder\s*m[åa]l/i;
  const ELEMENT_NUM_RX = /\b(\d{3})(?:\.(\d{3}))?\b/;

  const mainCandidates = rows.filter(
    (r) => r.name && HOVED_RX.test(r.name) && r.type === "ELECTRICITY",
  );

  for (const row of rows) {
    const resolved = perRow.get(row.tempId);
    if (!resolved || resolved.parentTempId) continue;
    if (!row.isSubMeter) continue;
    if (row.type !== "ELECTRICITY") continue;
    if (!row.name) continue;

    const elementMatch = row.name.match(ELEMENT_NUM_RX);
    const systemCode = elementMatch?.[1];
    const elementNum = elementMatch?.[2];
    if (!systemCode) continue;

    if (elementNum && UNDER_RX.test(row.name)) {
      const fullElement = `${systemCode}.${elementNum}`;
      const candidates = rows.filter((m) => {
        if (m.tempId === row.tempId) return false;
        if (m.type !== "ELECTRICITY") return false;
        if (!m.name) return false;
        if (UNDER_RX.test(m.name)) return false; // andre under-rader er ikke parent
        return m.name.includes(fullElement);
      });

      if (candidates.length > 0) {
        const parent = candidates.sort(
          (a, b) => (a.name?.length ?? 0) - (b.name?.length ?? 0),
        )[0];
        resolved.parentTempId = parent.tempId;
        resolved.parentReason = `Navn-heuristikk: deler element ${fullElement} med "${parent.name}".`;
        continue;
      }
    }

    const parent = mainCandidates.find((m) => {
      if (m.tempId === row.tempId) return false;
      return m.name?.includes(systemCode);
    });

    if (parent) {
      resolved.parentTempId = parent.tempId;
      resolved.parentReason = `Navn-heuristikk: deler systemkode ${systemCode} med "${parent.name}".`;
    }
  }
}


function resolveThermalDistributionParents(
  rows: RowWithTempId[],
  perRow: Map<string, ResolvedTopologyForRow>,
): void {
  const VARME_TIL_VENT_RX = /var?me\s*til\s*ventil/i;
  const VENT_NAME_RX = /\bventil(?:asjon)?\b|\bvent\b/i;

  const ventDistributors = rows.filter(
    (r) => r.type === "HEAT" && r.name && VARME_TIL_VENT_RX.test(r.name),
  );

  if (ventDistributors.length === 1) {
    const distributor = ventDistributors[0];
    for (const candidate of rows) {
      if (candidate.tempId === distributor.tempId) continue;
      if (candidate.type !== "HEAT") continue;
      if (!candidate.name) continue;
      const resolved = perRow.get(candidate.tempId);
      if (!resolved || resolved.parentTempId) continue;
      if (VARME_TIL_VENT_RX.test(candidate.name)) continue;

      const matchesVentName = VENT_NAME_RX.test(candidate.name);
      const matchesVentTag =
        candidate.parsedTag?.elementCategory === "VENTILATION_AGGREGATE";
      const matchesVentNumberInName = /\b360\.\d{3}/.test(candidate.name);

      if (!matchesVentName && !matchesVentTag && !matchesVentNumberInName) {
        continue;
      }

      resolved.parentTempId = distributor.tempId;
      resolved.parentReason = `Navn-heuristikk: termisk fordelings-måler "${distributor.name}" leverer varme til ventilasjon.`;
    }
  }
}


function resolveEnergySourceForThermalDistribution(
  rows: RowWithTempId[],
  perRow: Map<string, ResolvedTopologyForRow>,
): void {
  const heatSources = rows.filter((r) => {
    if (r.type !== "HEAT") return false;
    if (!r.name) return false;
    return HEAT_SOURCE_NAME_RX.test(r.name);
  });
  const coolSources = rows.filter((r) => {
    if (r.type !== "COOLING") return false;
    if (!r.name) return false;
    return COOL_SOURCE_NAME_RX.test(r.name);
  });

  const singleHeatSource = heatSources.length === 1 ? heatSources[0] : null;
  const singleCoolSource = coolSources.length === 1 ? coolSources[0] : null;

  for (const row of rows) {
    const resolved = perRow.get(row.tempId);
    if (!resolved) continue;
    if (!row.name) continue;
    if (row.type === "HEAT" && HEAT_SOURCE_NAME_RX.test(row.name)) continue;
    if (row.type === "COOLING" && COOL_SOURCE_NAME_RX.test(row.name)) continue;

    if (BRONN_NAME_RX.test(row.name)) continue;

    const isHeatDistribution = row.type === "HEAT";
    const isCoolDistribution = row.type === "COOLING";

    if (
      isHeatDistribution &&
      singleHeatSource &&
      singleHeatSource.tempId !== row.tempId
    ) {
      if (!resolved.energySourcedFromTempId) {
        resolved.energySourcedFromTempId = singleHeatSource.tempId;
        resolved.energySourceReason = `Eneste HEAT-produksjonsmåler — "${singleHeatSource.name}".`;
      }
    }
    if (
      isCoolDistribution &&
      singleCoolSource &&
      singleCoolSource.tempId !== row.tempId
    ) {
      if (!resolved.energySourcedFromTempId) {
        resolved.energySourcedFromTempId = singleCoolSource.tempId;
        resolved.energySourceReason = `Eneste COOLING-produksjonsmåler — "${singleCoolSource.name}".`;
      }
    }
  }

  const ambientSources = rows.filter(
    (r) => r.type === "COOLING" && r.name && BRONN_NAME_RX.test(r.name),
  );
  const singleAmbient = ambientSources.length === 1 ? ambientSources[0] : null;

  if (singleHeatSource && singleAmbient) {
    const resolved = perRow.get(singleHeatSource.tempId);
    if (resolved && !resolved.energySourcedFromTempId) {
      resolved.energySourcedFromTempId = singleAmbient.tempId;
      resolved.energySourceReason = `Ambient-kilde til VP — "${singleAmbient.name}".`;
    }
  }
}


function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}.]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function meterAliases(row: RowWithTempId): string[] {
  const aliases = [row.name, row.mpid, row.tag, row.externalId].filter(
    (value): value is string => Boolean(value && value.trim()),
  );
  const name = row.name ?? "";
  if (/hovedfordeling|hovedtavle/i.test(name)) {
    aliases.push("hovedfordeling", "hovedtavle", "432.101");
  }
  if (/var?me\s*produsert|produsert\s*var?me/i.test(name)) {
    aliases.push("varme produsert", "produsert varme", "vp varme");
  }
  if (/br[øo]nn\s*park|frikj[øo]ling/i.test(name)) {
    aliases.push("fra brønnpark", "brønnpark", "bronnpark", "frikjøling");
  }
  if (/var?me\s*til\s*ventil/i.test(name)) {
    aliases.push("varme til ventilasjon", "ventilasjonsvarme");
  }
  return aliases;
}

function findBestMeterRef(
  rawRef: string,
  rows: RowWithTempId[],
  excludeTempId: string,
): { row: RowWithTempId; confidence: number; reason: string } | null {
  const ref = normalizeForMatch(rawRef.replace(/\?/g, ""));
  if (!ref) return null;

  const scored = rows
    .filter((row) => row.tempId !== excludeTempId)
    .map((row) => {
      let score = 0;
      let reason = "";
      for (const alias of meterAliases(row)) {
        const normalizedAlias = normalizeForMatch(alias);
        if (!normalizedAlias) continue;
        if (normalizedAlias === ref) {
          score = Math.max(score, 0.98);
          reason = `eksakt match på "${alias}"`;
        } else if (
          normalizedAlias.includes(ref) ||
          ref.includes(normalizedAlias)
        ) {
          const nextScore = normalizedAlias.length === ref.length ? 0.95 : 0.82;
          if (nextScore > score) {
            score = nextScore;
            reason = `tekstmatch på "${alias}"`;
          }
        }
      }
      return { row, confidence: score, reason };
    })
    .filter((match) => match.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);

  if (scored.length === 0) return null;
  const [best, second] = scored;
  if (second && best.confidence - second.confidence < 0.08) {
    return null;
  }
  return best;
}

export function rowsShareElement(a: KsTag | null, b: KsTag | null): boolean {
  if (!a || !b) return false;
  return isSameElement(a, b);
}

export function ensureTempIds<T extends TransformedRow>(
  rows: T[],
): (T & { tempId: string })[] {
  return rows.map((r, idx) => ({
    ...r,
    tempId: `import-${idx}-${r.mpid ?? r.name ?? `row${idx}`}`.replace(
      /\s+/g,
      "-",
    ),
  }));
}

export function isProductionType(type: MeteringPointType): boolean {
  return type === "PRODUCTION";
}
