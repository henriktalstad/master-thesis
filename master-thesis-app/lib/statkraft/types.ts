export interface StatkraftAuthResponse {
  access_token: string;
  token_type?: string;
}

export interface StatkraftQuantity {
  name:
    | "Energy"
    | "Volume"
    | "Flow"
    | "Forward temperature"
    | "Return temperature"
    | "Difference temperature";
  unit: string;
  asConsumption: boolean;
}

export interface StatkraftMeterValuesRequest {
  ids: string[];
  reportAfter: string;
  reportBefore: string;
  quantities: StatkraftQuantity[];
  resolution: "hour" | "day" | "month" | "all";
}

export interface StatkraftValuePoint {
  when_Z: number | string;
  value: number;
}

export interface StatkraftMeterValues {
  quantity: string;
  unit: string;
  values: StatkraftValuePoint[];
}

export type StatkraftMeterValuesResponse = StatkraftMeterValues[];

export const STATKRAFT_DEFAULT_QUANTITIES: StatkraftQuantity[] = [
  { unit: "kWh", name: "Energy", asConsumption: true },
  { unit: "K", name: "Difference temperature", asConsumption: false },
  { unit: "°C", name: "Forward temperature", asConsumption: false },
  { unit: "°C", name: "Return temperature", asConsumption: false },
  { unit: "m3", name: "Volume", asConsumption: true },
];

export const STATKRAFT_CONFIG = {
  baseUrl: "https://apigw.statkraft.com/dh/radata/external/v1",
  defaultTimeout: 60_000,
  maxRetries: 3,
} as const;

export type MappedDistrictHeatingMeasurement = {
  time: Date;
  utcTime: Date;
  energyKwh: number | null;
  flowM3h: number | null;
  forwardTempC: number | null;
  returnTempC: number | null;
  diffTempK: number | null;
  volumeM3: number | null;
  resolution: string;
  metadata: Record<string, unknown>;
};

export interface StatkraftSyncResult {
  success: boolean;
  mpid: string;
  message?: string;
  error?: string;
  totalMeasurements: number;
  newMeasurements: number;
  skippedMeasurements: number;
}
