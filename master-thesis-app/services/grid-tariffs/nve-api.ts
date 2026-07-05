const NVE_ENDPOINT =
  "https://nettleietariffer.dataplattform.nve.no/v1/NettleiePrFylkePrTimeNaringEffekttariffer";

export type NveGridTariffRow = {
  datoId: string;
  tariffgruppe: string;
  konsesjonar: string;
  organisasjonsnr: string;
  fylkeNr: string;
  fylke: string;
  fastleddKrMnd: number;
  effektleddKrKW: number;
  energileddOreKWh: number;
  effekttrinnFraKw: number | null;
  effekttrinnTilKw: number | null;
  grunnlagEffektrinn: string | null;
  time: number;
};

export async function fetchNveGridTariffs(input: {
  dateYmd: string;
  countyCode: string;
  organizationNumber: string;
  tariffGroup: number;
}): Promise<NveGridTariffRow[]> {
  const endpoint = new URL(NVE_ENDPOINT);
  endpoint.searchParams.set("ValgtDato", input.dateYmd);
  endpoint.searchParams.set("FylkeNr", input.countyCode);
  endpoint.searchParams.set("OrganisasjonsNr", input.organizationNumber);
  endpoint.searchParams.set("Tariffgruppe", String(input.tariffGroup));

  const response = await fetch(endpoint.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 422) {
      console.warn(`[nve-api] 422 ${endpoint}: ${body.slice(0, 200)}`);
      return [];
    }
    throw new Error(
      `NVE ${response.status} for ${input.dateYmd}: ${body.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as NveGridTariffRow[];
  return Array.isArray(data) ? data : [];
}

export function normalizeNveFixedLinkKr(fastleddKrMnd: number): number {
  return fastleddKrMnd > 10_000 ? fastleddKrMnd / 100 : fastleddKrMnd;
}

export function calculateTrend(current: number, previous: number): number {
  if (previous <= 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function averageField(
  rows: NveGridTariffRow[],
  key: keyof Pick<
    NveGridTariffRow,
    "energileddOreKWh" | "fastleddKrMnd" | "effektleddKrKW"
  >,
): number {
  if (!rows.length) return 0;
  const sum = rows.reduce((acc, row) => acc + Number(row[key] ?? 0), 0);
  return sum / rows.length;
}
