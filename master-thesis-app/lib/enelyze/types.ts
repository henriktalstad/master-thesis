export interface ApiObservation {
  time: string;
  direction: string;
  method: string;
  volume_kwh: number;
}

export interface ApiResponse {
  mpid: string;
  start: string;
  end: string;
  observations: ApiObservation[];
}

export interface EnelyzeSyncResult {
  success: boolean;
  mpid: string;
  message?: string;
  error?: string;
  totalObservations: number;
  newObservations: number;
  skippedObservations: number;
}

export type MappedEnelyzeObservation = {
  time: Date;
  utcTime: Date;
  direction: string;
  method: string;
  volume_kwh: number;
};
