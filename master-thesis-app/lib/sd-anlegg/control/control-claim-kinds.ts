export type ControlClaimKind =
  | "observed"
  | "emulated"
  | "simulated"
  | "estimated"
  | "proxy";

export const CONTROL_CLAIM_LABELS: Record<
  ControlClaimKind,
  { short: string; description: string }
> = {
  observed: {
    short: "Målt",
    description: "Faktisk data fra SD eller energimåling",
  },
  emulated: {
    short: "Forventet",
    description: "Forventet normal drift uten alarmer",
  },
  simulated: {
    short: "Simulert",
    description: "Optimert styring i simulering",
  },
  estimated: {
    short: "Estimert",
    description: "Basert på modell og prognose",
  },
  proxy: {
    short: "Proxy",
    description: "Forenklet indikator — ikke direkte målt verdi",
  },
};
