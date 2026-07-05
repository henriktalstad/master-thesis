import type { ThesisEvalPeriod } from "./control-types";
import {
  CONTROL_LOOKBACK_PRESETS,
  resolveControlLookbackHours,
  type ControlPeriodMode,
} from "./resolve-control-lookback";

export type ControlWorkspacePeriod = {
  mode: ControlPeriodMode;
  since: Date;
  until: Date;
  lookbackHours: number;
  label: string;
};

export function resolveControlWorkspacePeriod(input: {
  periodMode: ControlPeriodMode;
  lookbackDaysParam?: string | string[];
  evalPeriod: ThesisEvalPeriod | null;
  now?: Date;
}): ControlWorkspacePeriod {
  const now = input.now ?? new Date();

  if (input.periodMode === "eval" && input.evalPeriod) {
    const since = new Date(input.evalPeriod.evalStart);
    const until = new Date(input.evalPeriod.evalEnd);
    const lookbackHours = Math.max(
      1,
      Math.ceil((until.getTime() - since.getTime()) / 3_600_000),
    );
    return {
      mode: "eval",
      since,
      until,
      lookbackHours,
      label: "Eval",
    };
  }

  const lookbackHours = resolveControlLookbackHours(input.lookbackDaysParam);
  const since = new Date(now.getTime() - lookbackHours * 3_600_000);
  const preset = CONTROL_LOOKBACK_PRESETS.find((p) => p.hours === lookbackHours);

  return {
    mode: "live",
    since,
    until: now,
    lookbackHours,
    label: preset?.label ?? `${Math.round(lookbackHours / 24)} d`,
  };
}
