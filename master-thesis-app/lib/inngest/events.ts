export const INNGEST_EVENTS = {
  INFRASPAWN_SYNC_COMPLETED: "pipeline/infraspawn.sync.completed",
  MPC_CONTROL_TICK_REQUESTED: "mpc/control-tick.requested",
  MPC_SIMULATION_REQUESTED: "mpc/simulation.requested",
  MPC_PERSIST_SD_BUCKETS: "mpc/persist-sd-buckets.requested",
} as const;

export type InngestEventName =
  (typeof INNGEST_EVENTS)[keyof typeof INNGEST_EVENTS];

export type MpcSimulationRequestedEvent = {
  buildingId: string;
  buildingSlug: string;
  jobId: string;
  evalStart?: string;
  evalEnd?: string;
  solverProfile?: "thesis" | "interactive";
};

export type MpcPersistSdBucketsEvent = {
  buildingId: string;
  buildingSlug: string;
  bucketMinutes: 1 | 5;
  pipelineRunId: string | null;
  profiles: import("@/lib/sd-anlegg/control/control-sd-calibration").ControlSdHourlyProfile[];
};

export type InfraspawnSyncCompletedEvent = {
  ok?: boolean;
  sourcesSynced?: number;
  rowsUpserted?: number;
  succeeded?: number;
  failed?: number;
};
