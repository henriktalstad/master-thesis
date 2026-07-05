import { StatkraftAuthError } from "@/lib/statkraft/auth";
import {
  STATKRAFT_CONFIG,
  type StatkraftMeterValuesRequest,
  type StatkraftMeterValuesResponse,
} from "@/lib/statkraft/types";

export function getStatkraftSubscriptionKeyOverride(): string | undefined {
  return process.env.STATKRAFT_SUBSCRIPTION_KEY?.trim() || undefined;
}

export function formatStatkraftIso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export async function fetchStatkraftMeterValues(
  accessToken: string,
  subscriptionKey: string,
  request: StatkraftMeterValuesRequest,
  retryCount = STATKRAFT_CONFIG.maxRetries,
): Promise<StatkraftMeterValuesResponse> {
  const url = `${STATKRAFT_CONFIG.baseUrl}/getMeterValues`;

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "subscription-key": subscriptionKey,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(STATKRAFT_CONFIG.defaultTimeout),
      });

      const responseText = await response.text();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new StatkraftAuthError(
            `Statkraft API auth ${response.status}: ${responseText.slice(0, 200)}`,
          );
        }
        throw new Error(
          `Statkraft getMeterValues ${response.status}: ${responseText.slice(0, 200)}`,
        );
      }

      if (!responseText.trim()) return [];

      const meterValues = JSON.parse(responseText) as StatkraftMeterValuesResponse;
      if (!Array.isArray(meterValues)) {
        throw new Error("Statkraft getMeterValues: forventet array");
      }
      return meterValues;
    } catch (error) {
      if (error instanceof StatkraftAuthError || attempt === retryCount) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }

  throw new Error("Statkraft getMeterValues failed");
}
