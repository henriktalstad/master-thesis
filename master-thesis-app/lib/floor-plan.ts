export type IngestUiStepStatus = "pending" | "active" | "completed" | "failed";

export type IngestUiStep = {
  id: string;
  label: string;
  status: IngestUiStepStatus;
  description?: string;
  detail?: string;
};
