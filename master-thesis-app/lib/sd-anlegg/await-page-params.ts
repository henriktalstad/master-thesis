import "server-only";

import { connection } from "next/server";

export async function awaitSdAnleggPageParams<T extends Record<string, string>>(
  params: Promise<T>,
): Promise<T> {
  const [, resolved] = await Promise.all([connection(), params]);
  return resolved;
}
