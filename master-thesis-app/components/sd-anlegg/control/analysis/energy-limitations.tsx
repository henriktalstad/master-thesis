"use client";

import { CONTROL_KNOWN_LIMITATIONS } from "@/lib/sd-anlegg/control/control-display-labels";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function SdAnleggControlEnergyLimitations({ className }: Props) {
  return (
    <ul className={cn("space-y-1.5 text-xs text-muted-foreground", className)}>
      {CONTROL_KNOWN_LIMITATIONS.map((item) => (
        <li key={item} className="flex gap-2">
          <span aria-hidden className="text-primary">
            ·
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
