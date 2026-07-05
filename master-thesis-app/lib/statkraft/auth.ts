import { prisma } from "@/lib/db";
import {
  STATKRAFT_CONFIG,
  type StatkraftAuthResponse,
} from "@/lib/statkraft/types";

export class StatkraftAuthError extends Error {
  readonly isAuthError = true;

  constructor(message: string) {
    super(message);
    this.name = "StatkraftAuthError";
  }
}

export async function authenticateStatkraft(
  subscriptionKey: string,
  retryCount = STATKRAFT_CONFIG.maxRetries,
): Promise<StatkraftAuthResponse> {
  const url = `${STATKRAFT_CONFIG.baseUrl}/oauth2/token`;

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "subscription-key": subscriptionKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(STATKRAFT_CONFIG.defaultTimeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401 || response.status === 403) {
          throw new StatkraftAuthError(
            `Statkraft auth ${response.status}: ${errorText.slice(0, 200)}`,
          );
        }
        throw new Error(
          `Statkraft authentication failed (${response.status}): ${errorText.slice(0, 200)}`,
        );
      }

      const authResponse = (await response.json()) as StatkraftAuthResponse;
      if (!authResponse.access_token) {
        throw new Error("Invalid Statkraft auth response");
      }
      return authResponse;
    } catch (error) {
      if (error instanceof StatkraftAuthError || attempt === retryCount) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }

  throw new Error("Statkraft authentication failed");
}

export function isTokenValid(tokenExpiresAt: Date | null): boolean {
  if (!tokenExpiresAt) return false;
  const bufferMs = 5 * 60 * 1000;
  return tokenExpiresAt.getTime() > Date.now() + bufferMs;
}

export async function getValidAccessToken(
  subscriptionKey: string,
  currentToken?: string | null,
  tokenExpiresAt?: Date | null,
): Promise<{ token: string; expiresAt: Date }> {
  if (currentToken && isTokenValid(tokenExpiresAt ?? null)) {
    return { token: currentToken, expiresAt: tokenExpiresAt! };
  }

  const authResponse = await authenticateStatkraft(subscriptionKey);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);
  return { token: authResponse.access_token, expiresAt };
}

export async function getOrRefreshAccessTokenForIntegration(
  integrationId: string,
  subscriptionKey: string,
): Promise<{ token: string; expiresAt: Date }> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    select: { accessToken: true, tokenExpiresAt: true },
  });

  const { token, expiresAt } = await getValidAccessToken(
    subscriptionKey,
    integration?.accessToken,
    integration?.tokenExpiresAt,
  );

  if (token !== integration?.accessToken) {
    await prisma.integration.update({
      where: { id: integrationId },
      data: { accessToken: token, tokenExpiresAt: expiresAt },
    });
  }

  return { token, expiresAt };
}

export async function invalidateIntegrationToken(
  integrationId: string,
): Promise<void> {
  await prisma.integration.update({
    where: { id: integrationId },
    data: { accessToken: null, tokenExpiresAt: null },
  });
}
