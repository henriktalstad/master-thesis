export { MPC_CONTROL_MODEL_VERSION } from "../mpc/config/mpc-config";

/** Live MPC kalibrerer plant/emulator fra siste N dager SD (15-min). */
export const LIVE_MPC_CALIBRATION_DAYS = 14;

/** Standard replay-vindu i UI (96 × 15 min = 24 t). Overstyres av LIVE_MPC_REPLAY_STEPS. */
export const LIVE_MPC_REPLAY_STEPS_DEFAULT = 96;

/** Min. SD-steg for live fit når ingen DB-kalibrering finnes. */
export const LIVE_MPC_MIN_CALIBRATION_STEPS = 96;

/** Maks lookback (dager) — matcher UI-presets. */
export const LIVE_MPC_MAX_LOOKBACK_DAYS = 30;

/** Steg per inkrementell replay-batch (page load / cron). */
export const LIVE_MPC_INCREMENTAL_REPLAY_BATCH = 96;

/** Antall inkrementelle replay-batcher per cron-kjøring (catch-up). */
export function getMpcIncrementalReplayMaxBatches(): number {
  const raw = process.env.MPC_INCREMENTAL_REPLAY_MAX_BATCHES;
  const parsed = raw != null ? Number.parseInt(raw, 10) : 4;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
}

/** Behold replay-steg i DB (dager) — minst maks lookback. */
export const LIVE_MPC_REPLAY_RETENTION_DAYS = 35;

/** Steg per checkpoint-batch under full simulering. */
export const MPC_SIMULATION_CHECKPOINT_BATCH = 96;

/** RUNNING-jobb uten fremdrift → marker som avbrutt (kan gjenopptas). */
export const MPC_SIMULATION_STALE_NO_PROGRESS_MS = 20 * 60 * 1000;

/** Maks total kjøretid før avbrudd (804 steg ≈ flere timer). */
export const MPC_SIMULATION_STALE_MAX_RUNTIME_MS = 8 * 60 * 60 * 1000;

/** Gjenoppta FAILED-jobb med checkpoint innen dette vinduet. */
export const MPC_SIMULATION_RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Vis ferdig/feilet simulering i UI etter dette vinduet. */
export const MPC_SIMULATION_RECENT_JOB_MS = 3 * 60 * 1000;

export const CONTROL_TICK_STALE_MS = 45 * 60 * 1000;

/** Min. avstand mellom auto-tick fra Styring-fanen (matcher server cron-intervall). */
export const STYRING_AUTO_TICK_COOLDOWN_MS = 12 * 60 * 1000;

/** Hvor ofte klienten sjekker om plan/tick er utdatert på Styring-fanen. */
export const STYRING_AUTO_TICK_CHECK_MS = 60 * 1000;

export const MPC_WORKSPACE_REVISION_POLL_MS = 60_000;
export const MPC_WORKSPACE_REVISION_POLL_RUNNING_MS = 12_000;
export const MPC_WORKSPACE_REFRESH_COOLDOWN_MS = 60_000;

/** Min. avstand mellom automatisk ensure ved side-last (unngår Inngest-støy). */
export const MPC_BACKGROUND_ENSURE_COOLDOWN_MS = 10 * 60 * 1000;
export const STYRING_LIVE_POLL_MS = 15_000;
export const STYRING_LIVE_POLL_FINE_MS = 5_000;
