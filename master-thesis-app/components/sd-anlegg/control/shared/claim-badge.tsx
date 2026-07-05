"use client";

import { Badge } from "@/components/ui/badge";
import {
  CONTROL_CLAIM_LABELS,
  type ControlClaimKind,
} from "@/lib/sd-anlegg/control/control-claim-kinds";
import { cn } from "@/lib/utils";

type Props = {
  kind: ControlClaimKind;
  className?: string;
};

const VARIANT: Record<
  ControlClaimKind,
  "default" | "secondary" | "outline" | "destructive"
> = {
  observed: "secondary",
  emulated: "outline",
  simulated: "default",
  estimated: "outline",
  proxy: "outline",
};

export function SdAnleggControlClaimBadge({ kind, className }: Props) {
  const meta = CONTROL_CLAIM_LABELS[kind];
  return (
    <Badge
      variant={VARIANT[kind]}
      className={cn("text-[10px] font-normal", className)}
      title={meta.description}
    >
      {meta.short}
    </Badge>
  );
}
