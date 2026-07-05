import "server-only";

import * as crypto from "crypto";

export type IntegrationCredentials = {
  clientId: string;
  clientSecret: string;
  subscriptionKey?: string;
  apiUrl?: string;
  identityUrl?: string;
};

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;

function resolveMasterKey(): Buffer {
  const masterKeyString = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!masterKeyString) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY mangler — kreves for å dekryptere Integration-credentials fra DB",
    );
  }

  const cleanKey = masterKeyString.replace(/\s/g, "");
  if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY må være en 64-tegns hex-streng (32 bytes)",
    );
  }

  const masterKey = Buffer.from(cleanKey, "hex");
  if (masterKey.length !== 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY må være nøyaktig 32 bytes");
  }
  return masterKey;
}

function deriveKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(resolveMasterKey(), salt, 100000, KEY_LENGTH, "sha512");
}

function looksEncrypted(value: string): boolean {
  return value.split(":").length === 4;
}

export function encrypt(text: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(salt);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return [
    salt.toString("base64"),
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted,
  ].join(":");
}

export function decrypt(encryptedText: string): string {
  const trimmed = encryptedText.trim();
  if (!looksEncrypted(trimmed)) {
    return trimmed;
  }

  const parts = trimmed.split(":");
  if (parts.length !== 4) {
    throw new Error("Ugyldig kryptert dataformat");
  }

  const [saltB64, ivB64, authTagB64, encryptedData] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const key = deriveKey(salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export async function getIntegrationCredentials(
  integrationId: string,
): Promise<IntegrationCredentials> {
  const { prisma } = await import("@/lib/db");
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    select: {
      clientId: true,
      clientSecretEncrypted: true,
      subscriptionKeyEncrypted: true,
      apiUrl: true,
      identityUrl: true,
    },
  });

  if (!integration) {
    throw new Error(`Integration ${integrationId} not found`);
  }

  const envOverride = process.env.STATKRAFT_SUBSCRIPTION_KEY?.trim();
  const subscriptionKey = envOverride
    ? envOverride
    : integration.subscriptionKeyEncrypted
      ? decrypt(integration.subscriptionKeyEncrypted)
      : undefined;

  if (!subscriptionKey) {
    throw new Error(
      "Statkraft subscription key mangler — sett STATKRAFT_SUBSCRIPTION_KEY eller Integration.subscriptionKeyEncrypted",
    );
  }

  return {
    clientId: integration.clientId ?? "",
    clientSecret: integration.clientSecretEncrypted
      ? decrypt(integration.clientSecretEncrypted)
      : "",
    subscriptionKey,
    apiUrl: integration.apiUrl ?? undefined,
    identityUrl: integration.identityUrl ?? undefined,
  };
}
