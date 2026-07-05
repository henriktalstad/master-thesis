/**
 * MPC-automatisering er på som standard (dev + prod).
 * Env-variablene er av-knapper for reproduksjon/lokal feilsøking — ikke opt-in.
 * Skru av eksplisitt med MPC_AUTO_RUN=0 / MPC_AUTO_ENSURE=0 ved behov.
 */
function parseEnvOptOut(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return true;
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") {
    return false;
  }
  return true;
}

/** Cron/post-sync replay, control-tick-kjede og runMpcWhenReady uten forceRun. */
export function isMpcAutoRunEnabled(): boolean {
  return parseEnvOptOut("MPC_AUTO_RUN");
}

/** Bakgrunns-ensure ved page load når eval/replay mangler. */
export function isMpcAutoEnsureEnabled(): boolean {
  return parseEnvOptOut("MPC_AUTO_ENSURE");
}
