import { setTimeout as wait } from "timers/promises";

const FROST_BASE = process.env.FROST_BASE_URL ?? "https://frost.met.no";
const CLIENT_ID = process.env.FROST_CLIENT_ID as string | undefined;
const CLIENT_SECRET = process.env.FROST_CLIENT_SECRET as string | undefined;

let frostCallCount = 0;
export function resetFrostCallCount() {
  frostCallCount = 0;
}
export function getFrostCallCount() {
  return frostCallCount;
}

let oauthTokenCache: { token: string; exp: number } | null = null;
const baseBasicAuth = CLIENT_ID
  ? `Basic ${Buffer.from(`${CLIENT_ID}:`).toString("base64")}`
  : undefined;

async function getOAuthToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET)
    throw new Error("FROST_CLIENT_ID/SECRET mangler for OAuth");
  const now = Date.now();
  if (oauthTokenCache && oauthTokenCache.exp - 60_000 > now)
    return oauthTokenCache.token;
  const res = await fetch(`${FROST_BASE}/auth/accessToken`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok)
    throw new Error(`Frost OAuth error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  oauthTokenCache = {
    token: json.access_token,
    exp: now + json.expires_in * 1000,
  };
  return oauthTokenCache.token;
}

async function authHeader(): Promise<Record<string, string>> {
  if (!CLIENT_ID) throw new Error("FROST_CLIENT_ID mangler i miljøvariabler");
  if (CLIENT_SECRET) {
    const token = await getOAuthToken();
    return { Authorization: `Bearer ${token}` };
  }
  if (!baseBasicAuth)
    throw new Error("Basic auth kan ikke settes (mangler CLIENT_ID)");
  return { Authorization: baseBasicAuth };
}

function qs(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) search.set(k, v.join(","));
    else search.set(k, String(v));
  }
  return search.toString();
}

function buildHeaders(extra?: Record<string, string>) {
  return { Accept: "application/json", ...(extra ?? {}) };
}

async function frostGet<T>(
  path: string,
  params: Record<string, unknown>,
  retries = 5,
  signal?: AbortSignal,
): Promise<T> {
  const url = `${FROST_BASE}${path}?${qs(params)}`;
  for (let i = 0; i <= retries; i++) {
    frostCallCount += 1;
    const controller = new AbortController();
    const timeoutMs = 30_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: buildHeaders({
          ...(await authHeader()),
          "User-Agent": `master-thesis-app/1.0 (+kontakt@scoped.no)`,
        }),
        signal: signal ?? controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) return (await res.json()) as T;
      if (res.status === 429 || res.status >= 500) {
        const jitter = Math.random() * 250;
        const delay = Math.min(2000 * Math.pow(2, i) + jitter, 20000);
        await wait(delay);
        continue;
      }
      const body = await res.text();
      throw new Error(`Frost error ${res.status}: ${body}`);
    } catch (e) {
      // Behandle abort som retrybar feil
      const msg = String(e instanceof Error ? e.message : e);
      if (
        msg.includes("The operation was aborted") ||
        msg.includes("aborted")
      ) {
        const jitter = Math.random() * 250;
        const delay = Math.min(2000 * Math.pow(2, i) + jitter, 20000);
        await wait(delay);
        continue;
      }
      throw e;
    }
  }
  throw new Error(`Frost retry exhausted for ${path}`);
}

export async function getStationsInMunicipality(municipalityNumber: string) {
  // v0 støtter 'municipality' (tekstlig navn eller kode i noen tilfeller). Vi forsøker municipality først,
  // og lar kalleren håndtere fallback til nearest() ved feil/404.
  return await frostGet<FrostSourcesResponse>("/sources/v0.jsonld", {
    types: "SensorSystem",
    fields: "id,name,geometry,masl",
    municipality: municipalityNumber,
  });
}

export async function getNearestStations(
  lon: number,
  lat: number,
  maxCount = 5,
) {
  return frostGet<FrostSourcesResponse>("/sources/v0.jsonld", {
    types: "SensorSystem",
    geometry: `nearest(POINT(${lon} ${lat}))`,
    nearestmaxcount: String(maxCount),
    fields: "id,name,geometry,masl",
  });
}

export async function getAvailableTimeSeries(
  sourceIds: string[],
  referencetime: string,
  elements?: string,
  opts?: { timeresolutions?: string; performancecategories?: string },
) {
  return frostGet<FrostAvailableTimeSeriesResponse>(
    "/observations/availableTimeSeries/v0.jsonld",
    {
      sources: sourceIds,
      referencetime,
      elements,
      levels: "default",
      timeoffsets: "default",
      ...(opts?.timeresolutions
        ? { timeresolutions: opts.timeresolutions }
        : {}),
      ...(opts?.performancecategories
        ? { performancecategories: opts.performancecategories }
        : {}),
    },
  );
}

export type TimeChunk = { start: string; end: string };

export async function getObservations(params: {
  sources: string[];
  elements: string;
  referencetime: string;
  timechunks?: TimeChunk[];
}): Promise<FrostObservationsResponse | { items: FrostObservationItem[] }> {
  const { sources, elements, referencetime, timechunks } = params;
  const baseParams = {
    sources,
    elements,
    referencetime,
    levels: "default",
    timeoffsets: "default",
  };

  // Uten chunking:
  if (!timechunks || timechunks.length === 0) {
    try {
      return await frostGet<FrostObservationsResponse>(
        "/observations/v0.jsonld",
        baseParams,
      );
    } catch (e: unknown) {
      const msg = String(e instanceof Error ? e.message : e);
      if (
        msg.includes("404") ||
        msg.includes("412") ||
        msg.toLowerCase().includes("no time series found") ||
        msg.toLowerCase().includes("no data found")
      ) {
        return { items: [] };
      }
      throw e;
    }
  }

  // Med chunking:
  const allItems: FrostObservationItem[] = [];
  for (const chunk of timechunks) {
    try {
      const data = await frostGet<FrostObservationsResponse>(
        "/observations/v0.jsonld",
        {
          ...baseParams,
          referencetime: `${chunk.start}/${chunk.end}`,
        },
      );
      const items = Array.isArray(data?.data)
        ? data.data!
        : Array.isArray(data?.items)
          ? data.items!
          : [];
      allItems.push(...items);
    } catch (e: unknown) {
      const msg = String(e instanceof Error ? e.message : e);
      if (
        msg.includes("404") ||
        msg.includes("412") ||
        msg.toLowerCase().includes("no time series found") ||
        msg.toLowerCase().includes("no data found")
      ) {
        // hopp over tidsvindu uten data for kombinasjonen
        continue;
      }
      throw e;
    }
  }
  return { items: allItems };
}

// Observations with stats: counts attempted vs skipped (404/412) when chunking
export async function getObservationsWithStats(params: {
  sources: string[];
  elements: string;
  referencetime: string;
  timechunks: TimeChunk[];
}): Promise<{
  items: FrostObservationItem[];
  attemptedChunks: number;
  skippedChunks: number;
}> {
  const { sources, elements, referencetime, timechunks } = params;
  const baseParams = {
    sources,
    elements,
    referencetime,
    levels: "default",
    timeoffsets: "default",
  } as const;
  let attemptedChunks = 0;
  let skippedChunks = 0;
  const allItems: FrostObservationItem[] = [];
  for (const chunk of timechunks) {
    attemptedChunks += 1;
    try {
      const data = await frostGet<FrostObservationsResponse>(
        "/observations/v0.jsonld",
        {
          ...baseParams,
          referencetime: `${chunk.start}/${chunk.end}`,
        },
      );
      const items = Array.isArray(data?.data)
        ? data.data!
        : Array.isArray(data?.items)
          ? data.items!
          : [];
      allItems.push(...items);
    } catch (e: unknown) {
      const msg = String(e instanceof Error ? e.message : e);
      if (
        msg.includes("404") ||
        msg.includes("412") ||
        msg.toLowerCase().includes("no time series found") ||
        msg.toLowerCase().includes("no data found")
      ) {
        skippedChunks += 1;
        continue;
      }
      throw e;
    }
  }
  return { items: allItems, attemptedChunks, skippedChunks };
}

export type FrostSourceItem = {
  id: string;
  name?: string;
  geometry?: { coordinates?: [number, number] };
  elevation?: number;
};
export type FrostSourcesResponse = {
  data?: FrostSourceItem[];
  items?: FrostSourceItem[];
};

export type FrostAvailableTimeSeriesItem = {
  elementId: string;
  sourceId?: string;
  timeResolution?: string;
  timeresolution?: string;
  level?: { value?: number } | number | null;
  sensor?: number | null;
  unit?: string | null;
  performancecategory?: string;
};
export type FrostAvailableTimeSeriesResponse = {
  data?: FrostAvailableTimeSeriesItem[];
  items?: FrostAvailableTimeSeriesItem[];
};

export type FrostObservationValue = {
  value?: number | null;
  qualityCode?: number | null;
  qualitycode?: number | null;
};
export type FrostObservationItem = {
  referenceTime?: string;
  referencetime?: string;
  observations?: FrostObservationValue[];
};
export type FrostObservationsResponse = {
  data?: FrostObservationItem[];
  items?: FrostObservationItem[];
};
