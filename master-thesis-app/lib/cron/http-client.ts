import type { PipelineJobName } from "@/lib/jobs/pipeline-jobs";

export type InvokeCronJobResult = {
  ok: boolean;
  status: number;
  job: PipelineJobName;
  body: unknown;
  error?: string;
};

/** Base URL for cron HTTP-kall (lokal dev default: localhost:PORT). */
export function resolveCronHttpBase(): string | null {
  const disabled = process.env.CRON_HTTP_BASE?.trim() === "";
  if (disabled) return null;

  const explicit = process.env.CRON_HTTP_BASE?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const port = process.env.PORT?.trim() || "3000";
  return `http://localhost:${port}`;
}

export async function waitForCronHttpBase(input?: {
  base?: string;
  maxAttempts?: number;
  delayMs?: number;
}): Promise<string> {
  const base = input?.base ?? resolveCronHttpBase();
  if (!base) {
    throw new Error(
      "CRON_HTTP_BASE er deaktivert. Sett CRON_HTTP_BASE=http://localhost:3000",
    );
  }

  const maxAttempts = input?.maxAttempts ?? 90;
  const delayMs = input?.delayMs ?? 2_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(base, { method: "HEAD", signal: AbortSignal.timeout(5_000) });
      if (res.ok || res.status === 404 || res.status === 405) {
        return base;
      }
    } catch {
      // server not ready
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    `[cron] Next.js-server svarer ikke på ${base} etter ${maxAttempts} forsøk`,
  );
}

export async function invokeCronJobHttp(
  job: PipelineJobName,
  input?: { base?: string },
): Promise<InvokeCronJobResult> {
  const base = input?.base ?? resolveCronHttpBase();
  if (!base) {
    return {
      ok: false,
      status: 0,
      job,
      body: null,
      error: "CRON_HTTP_BASE mangler",
    };
  }

  const headers: Record<string, string> = {};
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  const url = `${base}/api/cron/${job}`;
  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();

  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep raw
  }

  const record =
    body != null && typeof body === "object"
      ? (body as Record<string, unknown>)
      : null;
  const ok =
    res.ok &&
    (record?.ok === undefined || record.ok === true) &&
    record?.status !== "failed";

  return {
    ok,
    status: res.status,
    job,
    body,
    error:
      ok
        ? undefined
        : (typeof record?.error === "string"
            ? record.error
            : `HTTP ${res.status}`),
  };
}
