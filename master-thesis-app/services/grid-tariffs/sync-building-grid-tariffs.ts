import { prisma, withPrismaRetry } from "@/lib/db";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import {
  countyCodeToName,
  countyCodesFromMunicipalityNumber,
  toUTCForOslo,
} from "@/lib/utils";

function getBuildingSlug(): string | null {
  return resolveBuildingSlug() || null;
}
import {
  averageField,
  calculateTrend,
  fetchNveGridTariffs,
  normalizeNveFixedLinkKr,
} from "./nve-api";

export type SyncBuildingGridTariffsResult = {
  success: boolean;
  operatorName: string;
  counties: string[];
  tariffGroups: number[];
  rowsUpserted: number;
  monthsProcessed: number;
  durationMs: number;
  message: string;
};

const DEFAULT_TARIFF_GROUPS = [2, 3];
const MONTHS_LOOKBACK = Number(process.env.GRID_TARIFF_MONTHS_LOOKBACK ?? "24");
const GRID_TARIFF_TX = { maxWait: 15_000, timeout: 45_000 } as const;

function parseTariffGroups(): number[] {
  const raw = process.env.GRID_TARIFF_GROUPS?.trim();
  if (!raw) return DEFAULT_TARIFF_GROUPS;
  const groups = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return groups.length ? groups : DEFAULT_TARIFF_GROUPS;
}

function monthAnchorYmd(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-15`;
}

async function resolveThesisBuilding() {
  const slug = getBuildingSlug();
  if (!slug) return null;
  return prisma.building.findFirst({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      municipalityNumber: true,
      selectedGridOperatorId: true,
      selectedGridOperator: {
        select: {
          id: true,
          name: true,
          organizationNumber: true,
          counties: true,
        },
      },
    },
  });
}

async function resolveGridOperator(building: NonNullable<
  Awaited<ReturnType<typeof resolveThesisBuilding>>
>) {
  if (building.selectedGridOperator?.organizationNumber) {
    return building.selectedGridOperator;
  }

  const tensio = await prisma.gridOperator.findFirst({
    where: {
      active: true,
      name: { contains: "Tensio", mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      organizationNumber: true,
      counties: true,
    },
  });
  return tensio;
}

function resolveCounties(
  building: NonNullable<Awaited<ReturnType<typeof resolveThesisBuilding>>>,
): string[] {
  const fromMuni = countyCodesFromMunicipalityNumber(
    building.municipalityNumber,
  )
    .map((code) => countyCodeToName[code])
    .filter(Boolean);

  if (fromMuni.length) return fromMuni;

  return (building.selectedGridOperator?.counties ?? []).filter(Boolean);
}

async function syncMonthForTarget(input: {
  operatorId: string;
  operatorName: string;
  organizationNumber: string;
  county: string;
  countyCode: string;
  tariffGroup: number;
  year: number;
  month: number;
}): Promise<number> {
  const monthKey = `${input.year}-${String(input.month + 1).padStart(2, "0")}`;
  const anchorYmd = monthAnchorYmd(input.year, input.month);
  const tariffs = await fetchNveGridTariffs({
    dateYmd: anchorYmd,
    countyCode: input.countyCode,
    organizationNumber: input.organizationNumber,
    tariffGroup: input.tariffGroup,
  });

  if (tariffs.length < 12) {
    console.warn(
      `[sync-grid-tariffs] Ufullstendig NVE for ${input.operatorName}/${input.county}/${monthKey} (${tariffs.length} rader)`,
    );
    return 0;
  }

  const prevMonth = new Date(input.year, input.month - 1, 1);
  const prevTariffs = await fetchNveGridTariffs({
    dateYmd: monthAnchorYmd(prevMonth.getFullYear(), prevMonth.getMonth()),
    countyCode: input.countyCode,
    organizationNumber: input.organizationNumber,
    tariffGroup: input.tariffGroup,
  });

  const currentTotal =
    averageField(tariffs, "energileddOreKWh") +
    averageField(tariffs, "fastleddKrMnd") +
    averageField(tariffs, "effektleddKrKW");
  const prevTotal =
    averageField(prevTariffs, "energileddOreKWh") +
    averageField(prevTariffs, "fastleddKrMnd") +
    averageField(prevTariffs, "effektleddKrKW");
  const monthTrend = calculateTrend(currentTotal, prevTotal);

  const osloAnchorYmd = `${input.year}-${String(input.month + 1).padStart(2, "0")}-15`;
  const rows = tariffs.map((tariff) => ({
    gridOperatorId: input.operatorId,
    county: input.county,
    timestamp: new Date(toUTCForOslo(osloAnchorYmd, tariff.time)),
    tariffGroup: input.tariffGroup,
      energyLink: tariff.energileddOreKWh,
      fixedLink: normalizeNveFixedLinkKr(tariff.fastleddKrMnd),
      capacityLink: tariff.effektleddKrKW || null,
    powerStageFromKw: tariff.effekttrinnFraKw,
    powerstageToKw: tariff.effekttrinnTilKw,
    basisPowerStage: tariff.grunnlagEffektrinn || null,
    yearTrend: 0,
    monthTrend,
    weekTrend: 0,
  }));

  const monthStart = new Date(input.year, input.month, 1, 0, 0, 0, 0);
  const monthEnd = new Date(input.year, input.month + 1, 0, 23, 59, 59, 999);

  const [, result] = await withPrismaRetry(
    () =>
      prisma.$transaction(
        [
          prisma.gridTariff.deleteMany({
            where: {
              gridOperatorId: input.operatorId,
              county: input.county,
              tariffGroup: input.tariffGroup,
              timestamp: { gte: monthStart, lte: monthEnd },
            },
          }),
          prisma.gridTariff.createMany({ data: rows, skipDuplicates: true }),
        ],
        GRID_TARIFF_TX,
      ),
    { retries: 5, delayMs: 500 },
  );

  return result.count;
}

/**
 * Synkroniserer nettleie (NVE) for thesis-byggets nettoperatør (Tensio m.fl.).
 * Erstatter kun måned-scope for aktuell operatør/fylke — sletter ikke historikk utenfor måneden.
 */
export async function syncBuildingGridTariffs(): Promise<SyncBuildingGridTariffsResult> {
  const startTime = Date.now();
  const building = await resolveThesisBuilding();
  if (!building) {
    return {
      success: false,
      operatorName: "",
      counties: [],
      tariffGroups: [],
      rowsUpserted: 0,
      monthsProcessed: 0,
      durationMs: Date.now() - startTime,
      message: "Fant ikke thesis-bygg (BUILDING_SLUG)",
    };
  }

  const operator = await resolveGridOperator(building);
  if (!operator?.organizationNumber) {
    return {
      success: false,
      operatorName: "",
      counties: [],
      tariffGroups: [],
      rowsUpserted: 0,
      monthsProcessed: 0,
      durationMs: Date.now() - startTime,
      message: "Fant ingen nettoperatør med organisasjonsnummer",
    };
  }

  const countyNames = resolveCounties(building);
  const countyPairs = countyNames
    .map((name) => {
      const code = Object.entries(countyCodeToName).find(
        ([, n]) => n === name,
      )?.[0];
      return code ? { name, code } : null;
    })
    .filter((x): x is { name: string; code: string } => x != null);

  if (!countyPairs.length) {
    return {
      success: false,
      operatorName: operator.name,
      counties: [],
      tariffGroups: [],
      rowsUpserted: 0,
      monthsProcessed: 0,
      durationMs: Date.now() - startTime,
      message: "Fant ingen fylker for bygget",
    };
  }

  const tariffGroups = parseTariffGroups();
  const today = new Date();
  let rowsUpserted = 0;
  let monthsProcessed = 0;
  let monthsFailed = 0;

  for (let i = 0; i < MONTHS_LOOKBACK; i++) {
    const target = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = target.getFullYear();
    const month = target.getMonth();

    for (const county of countyPairs) {
      for (const tariffGroup of tariffGroups) {
        try {
          const count = await syncMonthForTarget({
            operatorId: operator.id,
            operatorName: operator.name,
            organizationNumber: operator.organizationNumber,
            county: county.name,
            countyCode: county.code,
            tariffGroup,
            year,
            month,
          });
          rowsUpserted += count;
          if (count > 0) monthsProcessed += 1;
        } catch (error) {
          monthsFailed += 1;
          console.error("[sync-grid-tariffs] month failed:", error);
        }
      }
    }
  }

  const message =
    monthsFailed === 0
      ? `Nettleie synket for ${operator.name}: ${rowsUpserted} rader`
      : `Nettleie delvis synket for ${operator.name}: ${rowsUpserted} rader, ${monthsFailed} måneder feilet`;

  return {
    success: monthsFailed === 0,
    operatorName: operator.name,
    counties: countyPairs.map((c) => c.name),
    tariffGroups,
    rowsUpserted,
    monthsProcessed,
    durationMs: Date.now() - startTime,
    message,
  };
}
