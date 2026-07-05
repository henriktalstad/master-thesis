export type EvalGroundTruthManifest = {
  evalStart: string;
  evalEnd: string;
  buildingSlug?: string;
  ahuUnitKey?: string;
  files: string[];
  notes?: string;
  generatedAt?: string;
};

export type EvalGroundTruthValidation = {
  resolution: "15min" | "hourly";
  expectedSteps: number;
  matchedSteps: number;
  missingSteps: number;
  extraSteps: number;
  coveragePct: number;
};

/** Valgfri ekstern avstemming (faktura/elhub) fra data/eval/*.csv */
export type CsvGroundTruthOverlay = {
  manifest: EvalGroundTruthManifest;
  validation: {
    electricity15min: EvalGroundTruthValidation | null;
    districtHeating15min: EvalGroundTruthValidation | null;
  };
  totals: {
    electricityKwh: number | null;
    districtHeatingKwh: number | null;
  };
  vsBhcc: {
    electricityDeltaKwh: number | null;
    electricityDeltaPct: number | null;
    districtHeatingDeltaKwh: number | null;
    districtHeatingDeltaPct: number | null;
  } | null;
};

export type EnergyGroundTruthSource = "bhcc_kost" | "data_eval_csv";

export type EnergyGroundTruthBundle = {
  /** Alltid BHCC/Kost — CSV er kun overlay */
  primarySource: EnergyGroundTruthSource;
  evalStart: string;
  evalEnd: string;
  measured: {
    electricityKwh: number;
    districtHeatingKwh: number;
    electricityCostKr: number;
    districtHeatingCostKr: number;
    totalCostKr: number;
    hourCount: number;
    hoursWithElectricity: number;
    hoursWithDistrictHeating: number;
  };
  /** Spot/marginal fra ENTSO-E / Nord Pool + nettleie fra Kost */
  prices: {
    spotHoursEntsoe: number;
    spotHoursNordPool: number;
    spotHoursUnknown: number;
    marginalAddonKrPerKwh: number;
    hoursWithMarginalPrice: number;
  };
  hourlyCoveragePct: number;
  csvOverlay: CsvGroundTruthOverlay | null;
  notes: string[];
};

/** @deprecated Bruk CsvGroundTruthOverlay */
export type EvalGroundTruthComparison = CsvGroundTruthOverlay;
