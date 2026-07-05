import type { ApiResponse } from "./types";

const DEFAULT_BASE_URL = "https://api.enelyze.com";

export function getEnelyzeApiKey(): string | undefined {
  return process.env.ENELYZE_API_KEY?.trim() || undefined;
}

export function getEnelyzeBaseUrl(): string {
  return process.env.ENELYZE_API_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

export async function fetchMeteringVolumes(
  mpid: string,
  start: Date,
  end: Date,
  options?: { apiKey?: string; baseUrl?: string },
): Promise<ApiResponse> {
  const apiKey = options?.apiKey ?? getEnelyzeApiKey();
  if (!apiKey) {
    throw new Error("ENELYZE_API_KEY mangler");
  }

  const baseUrl = options?.baseUrl ?? getEnelyzeBaseUrl();
  const startTime = start.toISOString();
  const endTime = end.toISOString();
  const url = `${baseUrl}/external/meteringpoints/volumes/${encodeURIComponent(mpid)}?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Enelyze API ${response.status} for ${mpid}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }

  const data = (await response.json()) as ApiResponse;
  if (!data || typeof data !== "object" || !Array.isArray(data.observations)) {
    throw new Error(`Ugyldig Enelyze-respons for ${mpid}`);
  }

  return data;
}
