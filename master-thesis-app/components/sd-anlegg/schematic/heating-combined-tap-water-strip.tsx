"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  HeatingProcessSlot,
  TapWaterPresentationModel,
} from "@/lib/sd-anlegg/heating-process-presentation";
import { HEATING_TAPWATER_UNIT_KEY } from "@/lib/sd-anlegg/heating-process-units";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import { TapWaterFlowSchematicFromModel } from "./tap-water-flow-schematic-from-model";

const EMPTY_SELECTED_KEYS: readonly string[] = [];

type Props = {
  buildingSlug: string;
  model: TapWaterPresentationModel;
  selectedKeys?: readonly string[];
  onActivateSlotAction?: (slot: HeatingProcessSlot) => void;
};

export function HeatingCombinedTapWaterLink({
  buildingSlug,
  model,
  selectedKeys = EMPTY_SELECTED_KEYS,
  onActivateSlotAction,
}: Props) {
  const href = `/sd-anlegg/${buildingSlug}/varme/${HEATING_TAPWATER_UNIT_KEY}`;
  const canActivate = Boolean(onActivateSlotAction);
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  return (
    <section className="mt-3 w-full min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card/60 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-muted/4 px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <Link
            href={href}
            className={cn(
              SD_ANLEGG_BTN_PRESS,
              "text-sm font-semibold leading-none text-primary hover:underline",
            )}
          >
            310.001 Forbruksvann
          </Link>
          <p className="mt-1 text-[11px] text-muted-foreground">
            TR001 · koblet fra primær 320.001 via utjevningstank LV001
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {model.setpoint.displayValue ? (
            <span className="text-xs text-muted-foreground">
              SP{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {model.setpoint.displayValue}
              </span>
            </span>
          ) : null}
          <Link
            href={href}
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium text-primary",
              SD_ANLEGG_BTN_PRESS,
            )}
          >
            Egen fane
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="px-2 py-2.5 sm:px-3">
        <TapWaterFlowSchematicFromModel
          variant="compact"
          model={model}
          selectedKeys={selectedKeySet}
          onActivate={canActivate ? onActivateSlotAction : undefined}
        />
      </div>
    </section>
  );
}
