import { minutesSinceIso } from "@/lib/infraspawn/display-format";

export const INFRASPAWN_MANUAL_SYNC_FRESH_THRESHOLD_MINUTES = 20;

export type InfraspawnManualSyncShowReason =
  | "never_synced"
  | "sync_error"
  | "sync_stale"
  | "dev_environment";

export type InfraspawnManualSyncVisibility =
  | { show: false }
  | {
      show: true;
      reason: InfraspawnManualSyncShowReason;
      variant: "secondary" | "outline";
    };

export function resolveInfraspawnManualSyncVisibility(
  input: {
    isActive: boolean;
    lastSuccessfulSyncAt: string | null;
    lastError: string | null;
  },
  options?: { now?: Date; isDevelopment?: boolean },
): InfraspawnManualSyncVisibility {
  const now = options?.now ?? new Date();
  const isDevelopment =
    options?.isDevelopment ?? process.env.NODE_ENV === "development";

  if (!input.isActive) {
    return { show: false };
  }

  if (isDevelopment) {
    return {
      show: true,
      reason: "dev_environment",
      variant: input.lastError ? "secondary" : "outline",
    };
  }

  if (input.lastError) {
    return { show: true, reason: "sync_error", variant: "secondary" };
  }

  if (!input.lastSuccessfulSyncAt) {
    return { show: true, reason: "never_synced", variant: "secondary" };
  }

  const minutes = minutesSinceIso(input.lastSuccessfulSyncAt, now);
  if (
    minutes === null ||
    minutes >= INFRASPAWN_MANUAL_SYNC_FRESH_THRESHOLD_MINUTES
  ) {
    return { show: true, reason: "sync_stale", variant: "outline" };
  }

  return { show: false };
}

export function infraspawnManualSyncButtonLabel(
  reason: InfraspawnManualSyncShowReason,
): string {
  if (reason === "never_synced") return "Hent data nå";
  if (reason === "sync_error") return "Prøv igjen";
  return "Oppdater nå";
}
