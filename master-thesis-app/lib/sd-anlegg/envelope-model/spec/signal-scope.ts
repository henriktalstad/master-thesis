export type PlantFeatureCategory =
  | "state"
  | "control"
  | "disturbance"
  | "observation"
  | "time";

export type PlantFeatureAvailability = "available" | "partial" | "missing";

export type PlantFeatureScope = {
  featureId: string;
  label: string;
  category: PlantFeatureCategory;
  availability: PlantFeatureAvailability;
  usedInModel: boolean;
  coveragePct: number | null;
};

export const PLANT_FEATURE_COVERAGE_THRESHOLD = 0.9;
