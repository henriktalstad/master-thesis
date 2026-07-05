"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Clock3, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type {
  AhuPresentationModel,
  AhuStatusSlot,
} from "@/lib/sd-anlegg/ahu-equipment-identification";
import {
  resolveAhuProcessSettingsItems,
  type AhuProcessSettingsItem,
} from "@/lib/sd-anlegg/ahu-process-settings";
import { isSdAnleggPointSelected } from "../sd-anlegg-point-key";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import { ProcessSchematicClock } from "./process-schematic-clock";
import {
  SD_ANLEGG_PROCESS_DRIFT_CELL,
  SD_ANLEGG_PROCESS_DRIFT_CELL_INTERACTIVE,
  SD_ANLEGG_PROCESS_DRIFT_CELL_SELECTED,
  SD_ANLEGG_PROCESS_DRIFT_CLOCK_CELL,
  SD_ANLEGG_PROCESS_DRIFT_LABEL,
  SD_ANLEGG_PROCESS_DRIFT_SETTINGS_BTN,
  SD_ANLEGG_PROCESS_DRIFT_STRIPE,
  SD_ANLEGG_PROCESS_DRIFT_VALUE,
  SD_ANLEGG_PROCESS_DRIFT_VALUE_LINK,
} from "./styles/process-schematic-styles";
import {
  driftStripeValueToneClass,
  resolveDriftStripeValueTone,
} from "@/lib/sd-anlegg/process-drift-stripe-display";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ProcessDriftStripeProps = {
  slots: AhuStatusSlot[];
  model: Pick<AhuPresentationModel, "processSlots">;
  setpointPoints: readonly InfraspawnPointListItem[];
  selectedKeys: Set<string>;
  onActivateStatus?: (slot: AhuStatusSlot) => void;
  onActivateSettingsItem?: (item: AhuProcessSettingsItem) => void;
};

export function ProcessDriftStripe({
  slots,
  model,
  setpointPoints,
  selectedKeys,
  onActivateStatus,
  onActivateSettingsItem,
}: ProcessDriftStripeProps) {
  const settingsItems = useMemo(
    () => resolveAhuProcessSettingsItems(model, setpointPoints),
    [model, setpointPoints],
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <section className={SD_ANLEGG_PROCESS_DRIFT_STRIPE}>
      <div className="flex min-w-max items-stretch">
        <div className={SD_ANLEGG_PROCESS_DRIFT_CLOCK_CELL}>
          <ProcessSchematicClock />
        </div>

        {slots.map((slot) => {
          const selected = isSdAnleggPointSelected(slot.primaryPoint, selectedKeys);
          const showScheduleIcon = slot.slotId === "status.schedule";
          const valueTone = resolveDriftStripeValueTone({
            slotId: slot.slotId,
            displayValue: slot.displayValue,
            alarm: slot.alarm,
          });

          const inner = (
            <>
              <span className={SD_ANLEGG_PROCESS_DRIFT_LABEL}>
                {showScheduleIcon ? (
                  <Clock3 className="size-[0.85em] shrink-0 opacity-70" aria-hidden />
                ) : null}
                {slot.label}
              </span>
              <span
                className={cn(
                  SD_ANLEGG_PROCESS_DRIFT_VALUE,
                  slot.primaryPoint && onActivateStatus && SD_ANLEGG_PROCESS_DRIFT_VALUE_LINK,
                  driftStripeValueToneClass(valueTone),
                )}
              >
                {slot.displayValue ?? "—"}
              </span>
            </>
          );

          const className = cn(
            "group/drift",
            SD_ANLEGG_PROCESS_DRIFT_CELL,
            selected && SD_ANLEGG_PROCESS_DRIFT_CELL_SELECTED,
            slot.primaryPoint &&
              onActivateStatus &&
              cn(SD_ANLEGG_PROCESS_DRIFT_CELL_INTERACTIVE, SD_ANLEGG_BTN_PRESS),
          );

          if (!slot.primaryPoint || !onActivateStatus) {
            return (
              <div key={slot.slotId} className={className}>
                {inner}
              </div>
            );
          }

          return (
            <button
              key={slot.slotId}
              type="button"
              className={className}
              onClick={() => onActivateStatus(slot)}
              aria-haspopup="dialog"
              aria-label={`Vis historikk for ${slot.label}`}
            >
              {inner}
            </button>
          );
        })}

        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                SD_ANLEGG_PROCESS_DRIFT_SETTINGS_BTN,
                SD_ANLEGG_BTN_PRESS,
                settingsItems.length === 0 && "text-muted-foreground/70",
              )}
              aria-expanded={settingsOpen}
              aria-haspopup="dialog"
            >
              <Settings2 className="size-[0.95em] shrink-0" aria-hidden />
              Innstillinger
              <ChevronDown
                className={cn(
                  "size-[0.95em] shrink-0 opacity-70 transition-transform duration-150 ease-out",
                  settingsOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="border-b px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">
                Driftsinnstillinger
              </p>
            </div>
            {settingsItems.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                Ingen innstillinger er tilgjengelige fra kilden ennå.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {settingsItems.map((item) => {
                  const selected = isSdAnleggPointSelected(item.point, selectedKeys);
                  const rowClass = cn(
                    "flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors duration-150 ease-out",
                    onActivateSettingsItem &&
                      cn(
                        SD_ANLEGG_BTN_PRESS,
                        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
                      ),
                    selected && "bg-primary/5",
                  );

                  const content = (
                    <>
                      <span className="min-w-0 flex-1 text-muted-foreground">
                        {item.label}
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-primary">
                        {item.displayValue}
                      </span>
                    </>
                  );

                  if (!onActivateSettingsItem) {
                    return (
                      <li key={item.id}>
                        <div className={rowClass}>{content}</div>
                      </li>
                    );
                  }

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={rowClass}
                        onClick={() => {
                          onActivateSettingsItem(item);
                          setSettingsOpen(false);
                        }}
                        aria-haspopup="dialog"
                        aria-label={`Vis historikk for ${item.label}`}
                      >
                        {content}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </section>
  );
}
