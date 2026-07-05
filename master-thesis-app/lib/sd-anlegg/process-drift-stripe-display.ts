export type DriftStripeValueTone =
  | "primary"
  | "success"
  | "warning"
  | "muted"
  | "destructive"
  | "foreground";

export function resolveDriftStripeValueTone(input: {
  slotId: string;
  displayValue: string | null | undefined;
  alarm?: boolean;
}): DriftStripeValueTone {
  const value = (input.displayValue ?? "").trim().toLowerCase();

  let tone: DriftStripeValueTone = "primary";

  if (!value || value === "—") {
    tone = "muted";
  } else {
    switch (input.slotId) {
      case "status.system":
        if (/feil|alarm/.test(value)) tone = "destructive";
        else if (/stoppet|stopp|av\b/.test(value)) tone = "warning";
        else if (/kjører|drift|på\b|start/.test(value)) tone = "primary";
        else tone = "foreground";
        break;
      case "status.schedule":
        if (value === "av" || /manuell|auto av/.test(value)) tone = "muted";
        else tone = "primary";
        break;
      case "status.frost":
        if (value === "normal") tone = "success";
        else if (/frost/.test(value)) tone = "destructive";
        else tone = "foreground";
        break;
      case "status.setpoint":
        tone = "primary";
        break;
      case "status.sfp":
        if (/stoppet/.test(value)) tone = "muted";
        else tone = "primary";
        break;
      default:
        tone = "primary";
    }
  }

  if (input.alarm) {
    if (input.slotId === "status.system" && /stoppet|stopp/.test(value)) {
      return "warning";
    }
    if (tone === "success" || tone === "primary" || tone === "foreground") {
      return "destructive";
    }
  }

  return tone;
}

export function driftStripeValueToneClass(tone: DriftStripeValueTone): string {
  switch (tone) {
    case "success":
      return "text-success";
    case "warning":
      return "text-warning";
    case "muted":
      return "text-muted-foreground";
    case "destructive":
      return "text-destructive";
    case "foreground":
      return "text-foreground";
    case "primary":
    default:
      return "text-primary";
  }
}
