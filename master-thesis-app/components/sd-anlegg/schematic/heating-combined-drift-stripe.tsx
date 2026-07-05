"use client";

import { cn } from "@/lib/utils";
import { isSdAnleggPointSelected } from "../sd-anlegg-point-key";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import type {
  HeatingCombinedBranch,
  HeatingProcessSlot,
} from "@/lib/sd-anlegg/heating-process-presentation";
import { resolveHeatingCombinedBranchLaneCopy } from "@/lib/sd-anlegg/heating-combined-blueprint";
import { ProcessSchematicClock } from "./process-schematic-clock";
import {
  SD_ANLEGG_PROCESS_DRIFT_CELL,
  SD_ANLEGG_PROCESS_DRIFT_CELL_INTERACTIVE,
  SD_ANLEGG_PROCESS_DRIFT_CELL_SELECTED,
  SD_ANLEGG_PROCESS_DRIFT_CLOCK_CELL,
  SD_ANLEGG_PROCESS_DRIFT_LABEL,
  SD_ANLEGG_PROCESS_DRIFT_STRIPE,
  SD_ANLEGG_PROCESS_DRIFT_VALUE,
  SD_ANLEGG_PROCESS_DRIFT_VALUE_LINK,
} from "./styles/process-schematic-styles";

type Props = {
  branches: readonly HeatingCombinedBranch[];
  outdoorTemp: HeatingProcessSlot | null;
  selectedKeys: Set<string>;
  onActivateSlot?: (slot: HeatingProcessSlot) => void;
  /** Utetemp vises i KPI-stripe for combined — unngå duplikat i driftstripe. */
  showOutdoorTemp?: boolean;
};

function DriftCell({
  label,
  slot,
  selectedKeys,
  onActivate,
}: {
  label: string;
  slot: HeatingProcessSlot;
  selectedKeys: Set<string>;
  onActivate?: (slot: HeatingProcessSlot) => void;
}) {
  const selected = isSdAnleggPointSelected(slot.primaryPoint, selectedKeys);
  const inner = (
    <>
      <span className={SD_ANLEGG_PROCESS_DRIFT_LABEL}>{label}</span>
      <span
        className={cn(
          SD_ANLEGG_PROCESS_DRIFT_VALUE,
          slot.primaryPoint && onActivate && SD_ANLEGG_PROCESS_DRIFT_VALUE_LINK,
          slot.confidence === "missing" && "text-muted-foreground",
        )}
      >
        {slot.displayValue ?? "—"}
      </span>
    </>
  );

  const className = cn(
    SD_ANLEGG_PROCESS_DRIFT_CELL,
    selected && SD_ANLEGG_PROCESS_DRIFT_CELL_SELECTED,
    slot.primaryPoint &&
      onActivate &&
      cn(SD_ANLEGG_PROCESS_DRIFT_CELL_INTERACTIVE, SD_ANLEGG_BTN_PRESS),
  );

  if (!slot.primaryPoint || !onActivate) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => onActivate(slot)}
      aria-haspopup="dialog"
      aria-label={`Vis historikk for ${label}`}
    >
      {inner}
    </button>
  );
}

export function HeatingCombinedDriftStripe({
  branches,
  outdoorTemp,
  selectedKeys,
  onActivateSlot,
  showOutdoorTemp = true,
}: Props) {
  return (
    <section className={SD_ANLEGG_PROCESS_DRIFT_STRIPE}>
      <div className="flex min-w-max items-stretch">
        <div className={SD_ANLEGG_PROCESS_DRIFT_CLOCK_CELL}>
          <ProcessSchematicClock />
        </div>

        {branches.map((branch) => {
          const copy = resolveHeatingCombinedBranchLaneCopy(branch.id);
          return (
            <DriftCell
              key={branch.id}
              label={`SPK ${copy.elementLabel}`}
              slot={branch.setpoint}
              selectedKeys={selectedKeys}
              onActivate={onActivateSlot}
            />
          );
        })}

        {showOutdoorTemp && outdoorTemp ? (
          <DriftCell
            label="Utetemp."
            slot={outdoorTemp}
            selectedKeys={selectedKeys}
            onActivate={onActivateSlot}
          />
        ) : null}
      </div>
    </section>
  );
}
